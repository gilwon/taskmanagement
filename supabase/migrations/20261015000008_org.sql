-- 조직 화면(구성원·팀·설정·초대 수락)이 쓰는 DB 경로를 더한다.
-- 워크스페이스 삭제, 초대 거절, pending 초대 중복 방지, 앱 내 알림 설정 반영, 초대됨 상태 보호.
--
-- 새 오류 코드(errcode 'P0001', rpc 마이그레이션의 오류 규약에 더한다).
--   files_remain      워크스페이스에 Storage 파일 객체가 남아 있어 삭제할 수 없다
--   confirm_mismatch  삭제 확인 입력이 워크스페이스 URL과 다르다
-- pending 초대 중복은 유니크 위반(23505)으로 올라온다.

-- ─────────────────────────────────────────────
-- pending 초대 중복 방지
-- ─────────────────────────────────────────────
-- 같은 워크스페이스·같은 이메일(대소문자 무시)의 pending 초대는 하나만 둔다.
-- 둘이면 my_invites에 같은 초대가 두 번 보이고 하나를 수락해도 나머지가 남는다.
create unique index workspace_invites_pending_email_key
  on public.workspace_invites (workspace_id, lower(email))
  where status = 'pending';

-- ─────────────────────────────────────────────
-- 초대 거절
-- ─────────────────────────────────────────────
-- 초대받은 본인이 자기 이메일의 pending 초대를 revoked로 바꾼다. 조회·not_found 규칙은 accept_invite와 같다.
-- 남의 초대이거나 처리된 초대는 not_found로 답한다(초대 존재를 드러내지 않는다).
-- definer 사유. 초대받은 사람은 workspace_invites 정책 대상이 아니고 auth.users 이메일을 읽을 수 없다.
create function public.decline_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_inv public.workspace_invites;
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = v_uid;
  select * into v_inv from public.workspace_invites i where i.id = p_invite for update;
  if not found or v_inv.status <> 'pending' or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  update public.workspace_invites i set status = 'revoked' where i.id = p_invite;
end;
$$;

-- ─────────────────────────────────────────────
-- 워크스페이스 삭제
-- ─────────────────────────────────────────────
-- active owner만 지운다. 확인 입력(p_confirm)이 워크스페이스 slug와 같아야 한다.
-- 하위 행은 cascade로 지워지지만 Storage 객체는 남아 고아가 된다. storage.objects는 SQL로 지울 수 없으므로
-- (protect_objects_delete 트리거) 객체가 하나라도 남아 있으면 files_remain으로 거부한다.
-- 앱 순서. 모든 프로젝트 soft_delete_project → 파일 객체를 Storage API로 삭제(can_remove_file_object가
-- 소프트 삭제된 프로젝트의 객체를 can_manage_project에게 허용) → delete_workspace.
-- 비구성원에게는 not_found로 답한다(존재를 드러내지 않는다).
-- definer 사유. workspaces에는 클라이언트 delete 정책·권한이 없고, 남은 객체 확인에 storage.objects를 읽어야 한다.
create function public.delete_workspace(p_workspace uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform private.require_uid();
  if not public.is_ws_member(p_workspace) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if public.ws_role(p_workspace) <> 'owner' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  select w.slug into v_slug from public.workspaces w where w.id = p_workspace for update;
  if p_confirm is distinct from v_slug then
    raise exception using errcode = 'P0001', message = 'confirm_mismatch';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'files' and o.name like p_workspace::text || '/%'
  ) then
    raise exception using errcode = 'P0001', message = 'files_remain';
  end if;
  delete from public.workspaces w where w.id = p_workspace;
end;
$$;

-- ─────────────────────────────────────────────
-- 초대됨(invited) 상태 보호
-- ─────────────────────────────────────────────
-- invited 구성원은 accept_invite(definer)로만 active가 된다. 관리자가 클라이언트로 status를 invited에서
-- 다른 값으로 바꾸면 본인 동의 없이 구성원을 넣는 셈이므로 막는다. 다른 값을 invited로 바꾸는 것도 막는다
-- (비활성화한 사람을 invited로 돌려 남은 초대로 스스로 돌아오게 하는 경로를 없앤다).
-- 초대됨 구성원을 빼려면 행을 지운다(on_workspace_member_deleted가 남은 초대를 회수한다).
-- definer 함수(accept_invite)와 시드는 current_user가 authenticated가 아니라 통과한다.
create function public.guard_member_invited_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and new.status is distinct from old.status
     and (old.status = 'invited' or new.status = 'invited') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger workspace_members_guard_invited
  before update of status on public.workspace_members
  for each row execute function public.guard_member_invited_status();

-- ─────────────────────────────────────────────
-- 앱 내 알림 설정 반영(rpc 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. 수신자의 user_prefs.notif_prefs에서 그 알림 종류(mention·assign·comment·update)가 false면 보내지 않는다.
-- 행이 없거나 키가 없으면 보낸다(기본값 켜짐). 나머지 동작은 rpc 마이그레이션과 같다.
-- 호출부는 모두 definer 트리거·RPC라 수신자의 user_prefs를 RLS 없이 읽는다.
create or replace function private.notify(
  p_user uuid,
  p_type public.notification_type,
  p_project uuid,
  p_task uuid,
  p_text text,
  p_snippet text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
begin
  if v_uid is null or p_user is null or p_user = v_uid then
    return false;
  end if;
  if private.project_perm_for(p_project, p_user) is null then
    return false;
  end if;
  select pr.workspace_id into v_ws from public.projects pr where pr.id = p_project;
  if exists (
    select 1 from public.user_prefs up
    where up.user_id = p_user and up.workspace_id = v_ws
      and up.notif_prefs ->> p_type::text = 'false'
  ) then
    return false;
  end if;
  insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet)
  values (p_user, v_ws, p_type, v_uid, p_task, p_project, p_text, p_snippet);
  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 실행 권한
-- ─────────────────────────────────────────────
revoke execute on function private.notify(uuid, public.notification_type, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.guard_member_invited_status() from public, anon, authenticated;

revoke execute on function
  public.decline_invite(uuid),
  public.delete_workspace(uuid, text)
from public, anon;
grant execute on function
  public.decline_invite(uuid),
  public.delete_workspace(uuid, text)
to authenticated;
