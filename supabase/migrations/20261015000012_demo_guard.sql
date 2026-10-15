-- 데모 계정의 자격 변경·워크스페이스 가입을 DB에서 막고, 게스트 판정 헬퍼를 private으로 옮기고, 프로젝트 리드 소속을 확인한다.
--
-- 데모 계정은 demo 시드(supabase/seeds/demo.sql)가 만들고 raw_app_meta_data.demo_seed = true로 표시한다.
-- 데모 비밀번호는 여러 사람이 공유하므로, 로그인한 사람이 비밀번호·이메일을 바꾸면 다른 사람이 데모에 들어갈 수 없게 된다.
-- 데모 계정으로 다른 워크스페이스에 가입하거나 새 워크스페이스를 만들면 시드 초기화 가드가 멈춘다.

-- ─────────────────────────────────────────────
-- 데모 계정 자격 변경 차단(auth.users 트리거)
-- ─────────────────────────────────────────────
-- 거부 조건. 변경 전 행이 demo_seed이고 encrypted_password나 email이 실제로 바뀌며, 다음 중 하나일 때다.
-- 1. 세션 로그인 역할이 supabase_auth_admin이다. GoTrue는 이 역할로 접속하고 JWT claims를 세팅하지 않는다.
--    사용자 비밀번호 변경(PUT /user)·복구·이메일 변경 확인이 모두 이 경로다.
--    service_role의 관리자 API(auth.admin.*)도 같은 역할로 들어와 함께 막힌다. DB에서는 둘을 구분할 수 없다.
-- 2. 요청 JWT의 사용자가 그 계정 자신이다(postgres 소유 definer 함수를 데모 사용자가 부른 경우).
-- 시드 스크립트는 postgres로 접속하고 JWT가 없어 통과한다.
-- last_sign_in_at 같은 로그인 컬럼과 토큰 컬럼은 보지 않는다. GoTrue는 비밀번호를 바꾸지 않는 UPDATE에도
-- encrypted_password를 SET 목록에 넣으므로 값 비교(is distinct from)로만 판정한다.
-- definer 사유. 트리거는 supabase_auth_admin으로도 발화하는데 이 역할에는 private 스키마 권한이 없다.
-- definer 안의 current_user는 소유자이므로 호출 역할은 session_user로 본다.
create function private.guard_demo_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.raw_app_meta_data ->> 'demo_seed' = 'true'
     and (new.encrypted_password is distinct from old.encrypted_password
          or new.email is distinct from old.email)
     and (session_user = 'supabase_auth_admin' or auth.uid() = old.id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger users_guard_demo
  before update on auth.users
  for each row execute function private.guard_demo_account();

-- 트리거 함수는 직접 호출할 일이 없다.
revoke execute on function private.guard_demo_account() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 온보딩(rpc 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. JWT app_metadata.demo_seed가 참이면 forbidden으로 거부한다. 나머지 동작은 rpc 마이그레이션과 같다.
-- definer 사유. 호출자는 아직 어느 워크스페이스의 구성원도 아니라 workspaces·workspace_members에
-- insert할 정책이 없다. 함수 안에서 auth.uid()를 확인하고 owner는 호출자 자신만 될 수 있다.
create or replace function public.create_workspace_onboarding(
  p_name text,
  p_slug text,
  p_usage text,
  p_team_size text,
  p_project_name text,
  p_template text,
  p_invite_emails text[] default '{}'
)
returns table (workspace_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_email text;
  v_my_email text;
  v_ws uuid;
begin
  if auth.jwt() -> 'app_metadata' ->> 'demo_seed' = 'true' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_name = '' or btrim(coalesce(p_project_name, '')) = '' then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}$' then
    raise exception using errcode = 'P0001', message = 'slug_invalid';
  end if;
  if p_team_size is not null and p_team_size not in ('solo', '2-10', '11-50', '51-200', '200+') then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;

  begin
    insert into public.workspaces (name, slug, usage, team_size, created_by)
    values (v_name, v_slug, nullif(btrim(coalesce(p_usage, '')), ''), p_team_size, v_uid)
    returning id into v_ws;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'slug_taken';
  end;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_ws, v_uid, 'owner', 'active');

  perform public.create_project(v_ws, p_project_name, 'folder', 'indigo', 'workspace', coalesce(p_template, 'blank'));

  select pf.email into v_my_email from public.profiles pf where pf.id = v_uid;
  for v_email in
    select distinct lower(btrim(e)) from unnest(coalesce(p_invite_emails, '{}')) as e
    where btrim(coalesce(e, '')) <> ''
  loop
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;
    if v_email is distinct from lower(v_my_email) then
      insert into public.workspace_invites (workspace_id, email, role, invited_by)
      values (v_ws, v_email, 'member', v_uid);
    end if;
  end loop;

  return query select v_ws, v_slug;
end;
$$;

-- ─────────────────────────────────────────────
-- 초대 수락(rpc 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. JWT app_metadata.demo_seed가 참이면 초대 조회 전에 forbidden으로 거부한다.
-- 나머지 동작은 rpc 마이그레이션과 같다.
-- definer 사유. workspace_members에는 클라이언트 insert 권한이 없다(동의 없는 구성원 추가 방지).
create or replace function public.accept_invite(p_invite uuid)
returns public.workspace_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_inv public.workspace_invites;
  v_email text;
  v_m public.workspace_members;
begin
  if auth.jwt() -> 'app_metadata' ->> 'demo_seed' = 'true' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  select * into v_inv from public.workspace_invites i where i.id = p_invite for update;
  if not found or v_inv.status <> 'pending' or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  select * into v_m from public.workspace_members m
  where m.workspace_id = v_inv.workspace_id and m.user_id = v_uid;
  if not found then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_inv.workspace_id, v_uid, v_inv.role, 'active')
    returning * into v_m;
  elsif v_m.status = 'invited' then
    update public.workspace_members m set status = 'active', role = v_inv.role
    where m.workspace_id = v_inv.workspace_id and m.user_id = v_uid
    returning * into v_m;
  end if;

  update public.workspace_invites i set status = 'accepted' where i.id = p_invite;
  return v_m;
end;
$$;

-- ─────────────────────────────────────────────
-- guest_shares_project를 private으로 이동(guest_visibility 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 다른 사용자(p_user)를 판정하는 헬퍼라 클라이언트 /rpc로 부를 수 없는 private 스키마에 둔다.
-- workspace_members_select 정책이 authenticated로 부르므로 authenticated 실행 권한은 남긴다.
-- private은 PostgREST 노출 스키마가 아니라 RPC로는 부를 수 없다.
-- 본문은 guest_visibility 마이그레이션과 같다.
-- definer 사유. project_members·projects RLS와 무관하게 판정해야 하고, 다른 사람 권한은 private 함수로만 본다.
create function private.guest_shares_project(ws uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.projects pr on pr.id = pm.project_id
    where pm.user_id = auth.uid() and pr.workspace_id = ws
      and private.project_perm_for(pr.id, p_user) is not null
  );
$$;

-- 본문은 guest_visibility 마이그레이션과 같고 부르는 헬퍼만 private으로 바뀌었다.
create or replace function public.shares_workspace(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members other on other.workspace_id = me.workspace_id
    where me.user_id = auth.uid() and me.status = 'active' and other.user_id = p_user
      and (me.role <> 'guest' or private.guest_shares_project(me.workspace_id, p_user))
  );
$$;

alter policy workspace_members_select on public.workspace_members
  using (
    user_id = (select auth.uid())
    or (public.is_ws_member(workspace_id)
        and (public.ws_role(workspace_id) <> 'guest' or private.guest_shares_project(workspace_id, user_id)))
  );

drop function public.guest_shares_project(uuid, uuid);

-- ─────────────────────────────────────────────
-- 프로젝트 수정 가드(rls 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. lead_id를 다른 사람으로 바꾸면 새 리드가 그 워크스페이스의 active·invited 구성원인지 확인하고
-- 아니면 invalid_assignee로 거부한다. 기준과 오류 코드는 create_project와 같다.
-- invoker라 workspace_members 조회는 RLS를 탄다. lead_id를 바꿀 수 있는 can_manage_project 사용자는
-- 게스트가 아닌 active 구성원이라 그 워크스페이스 행을 모두 본다. 나머지 동작은 rls 마이그레이션과 같다.
create or replace function public.guard_project_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.seq is distinct from old.seq
     or new.key is distinct from old.key
     or new.workspace_id is distinct from old.workspace_id
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if (new.access is distinct from old.access
      or new.lead_id is distinct from old.lead_id
      or new.archived_at is distinct from old.archived_at)
     and not public.can_manage_project(old.id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if new.lead_id is not null and new.lead_id is distinct from old.lead_id and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = old.workspace_id and m.user_id = new.lead_id and m.status in ('active', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_assignee';
  end if;
  return new;
end;
$$;

revoke execute on function
  public.create_workspace_onboarding(text, text, text, text, text, text, text[]),
  public.accept_invite(uuid),
  public.shares_workspace(uuid),
  private.guest_shares_project(uuid, uuid)
from public, anon;
grant execute on function
  public.create_workspace_onboarding(text, text, text, text, text, text, text[]),
  public.accept_invite(uuid),
  public.shares_workspace(uuid),
  private.guest_shares_project(uuid, uuid)
to authenticated;
-- 트리거 함수는 직접 호출할 일이 없다.
revoke execute on function public.guard_project_update() from public, anon, authenticated;
