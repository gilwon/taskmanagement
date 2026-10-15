-- RLS 정책과 Storage 정책이 호출하는 권한 판정 헬퍼 함수를 만든다.
-- 모든 헬퍼는 security definer다. 정책 안에서 다른 테이블을 읽으면 그 테이블의 RLS가 다시 걸려
-- 재귀가 생기므로, 판정에 필요한 조회는 RLS를 우회하는 이 함수들 안에서만 한다.
-- 각 함수는 auth.uid() 자신에 대한 판정만 돌려주므로 다른 사람의 권한 정보는 새지 않는다.
-- 다른 사용자 기준 판정(알림 수신자 검증)은 클라이언트가 부를 수 없는 private 스키마에만 둔다.

-- PostgREST가 노출하지 않는 스키마. 클라이언트가 /rpc로 부를 수 없는 내부 함수를 둔다.
create schema if not exists private;
grant usage on schema private to authenticated;

-- 현재 사용자가 워크스페이스의 active 구성원인지
create function public.is_ws_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- 현재 사용자의 워크스페이스 역할. active가 아니면 null
create function public.ws_role(ws uuid)
returns public.ws_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active';
$$;

-- 현재 사용자가 워크스페이스 owner 또는 admin인지
create function public.is_ws_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.ws_role(ws) in ('owner', 'admin'), false);
$$;

-- 지정한 사용자의 프로젝트 권한(spec R8)
-- owner/admin → full
-- guest → project_members 행이 있으면 least(perm, comment), 없으면 null
-- member → project_members 행이 있으면 그 perm, 없으면 access = workspace일 때 edit, private이면 null
-- 프로젝트 삭제 여부(deleted_at)는 보지 않는다. 보관함 조회·복원이 이 권한에 기대기 때문이다.
-- 삭제 상태는 project_is_live와 can_*_project_rows가 따로 본다.
create function private.project_perm_for(p uuid, p_user uuid)
returns public.share_perm
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
  v_access public.project_access;
  v_role public.ws_role;
  v_perm public.share_perm;
begin
  select pr.workspace_id, pr.access into v_ws, v_access
  from public.projects pr where pr.id = p;
  if v_ws is null then
    return null;
  end if;

  select m.role into v_role from public.workspace_members m
  where m.workspace_id = v_ws and m.user_id = p_user and m.status = 'active';
  if v_role is null then
    return null;
  end if;
  if v_role in ('owner', 'admin') then
    return 'full'::public.share_perm;
  end if;

  select pm.perm into v_perm
  from public.project_members pm
  where pm.project_id = p and pm.user_id = p_user;

  if v_role = 'guest' then
    -- least()는 null을 무시하므로 행이 없을 때를 먼저 걸러야 한다
    if v_perm is null then
      return null;
    end if;
    return least(v_perm, 'comment'::public.share_perm);
  end if;

  if v_perm is not null then
    return v_perm;
  end if;
  if v_access = 'workspace' then
    return 'edit'::public.share_perm;
  end if;
  return null;
end;
$$;

-- 현재 사용자의 프로젝트 권한
create function public.project_perm(p uuid)
returns public.share_perm
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_perm_for(p, auth.uid());
$$;

create function public.can_view_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_perm(p) is not null;
$$;

create function public.can_comment_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.project_perm(p) >= 'comment', false);
$$;

create function public.can_edit_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.project_perm(p) >= 'edit', false);
$$;

create function public.can_manage_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.project_perm(p) = 'full', false);
$$;

-- 프로젝트가 소프트 삭제 상태가 아닌지
create function public.project_is_live(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects pr where pr.id = p and pr.deleted_at is null);
$$;

-- 프로젝트 하위 행(tasks, subtasks, files, comments 등) 판정
-- 삭제된 프로젝트의 하위 행은 보관함·복원용으로 can_edit_project일 때만 보이고, 쓰기는 전부 거부한다.
create function public.can_view_project_rows(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.project_is_live(p) then public.can_view_project(p) else public.can_edit_project(p) end;
$$;

create function public.can_comment_project_rows(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_is_live(p) and public.can_comment_project(p);
$$;

create function public.can_edit_project_rows(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_is_live(p) and public.can_edit_project(p);
$$;

-- 현재 사용자와 지정한 사용자가 같은 워크스페이스에 속하는지(profiles 조회용)
-- 보는 쪽은 active, 보이는 쪽은 상태 무관(초대됨·비활성 구성원도 목록에 보여야 한다)
create function public.shares_workspace(p_user uuid)
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
  );
$$;

-- 작업이 속한 프로젝트 id(subtasks·comments·task_deps 정책용)
create function public.task_project_id(p_task uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id from public.tasks t where t.id = p_task;
$$;

-- 댓글이 속한 프로젝트 id(comment_reactions 정책용)
create function public.comment_project_id(p_comment uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id
  from public.comments c
  join public.tasks t on t.id = c.task_id
  where c.id = p_comment;
$$;

-- Storage 객체 판정. 객체 이름이 files 행의 storage_path와 정확히 같을 때만 연다.
-- storage_path는 check 제약으로 그 행의 워크스페이스·프로젝트·파일 id와 묶여 있다.

-- 조회(서명 URL 발급 포함). ready이고 삭제되지 않은 파일은 프로젝트를 볼 수 있으면 열린다.
-- 편집 권한자는 상태와 무관하게 연다. Storage API의 remove가 select 권한을 함께 요구해서
-- pending·failed·삭제된 파일 객체를 정리하려면 필요하다.
create function public.can_read_file_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.files f
    where f.storage_path = p_name
      and public.can_view_project(f.project_id)
      and ((f.status = 'ready' and f.deleted_at is null and public.project_is_live(f.project_id))
           or public.can_edit_project(f.project_id))
  );
$$;

-- 업로드. 같은 경로의 pending 행을 본인이 만들었고 지금도 편집 권한이 있을 때만
create function public.can_upload_file_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.files f
    where f.storage_path = p_name
      and f.status = 'pending'
      and f.deleted_at is null
      and f.uploaded_by = auth.uid()
      and public.can_edit_project_rows(f.project_id)
  );
$$;

-- 객체 삭제. 쓰이는 파일(ready·미삭제)의 객체는 지울 수 없다. ready 행만 남고 내용이 사라지는 일을 막는다.
-- pending·failed 행은 업로더 본인 또는 편집 권한자가 정리한다.
-- 소프트 삭제된 파일과 소프트 삭제된 프로젝트의 파일은 can_manage_project가 영구 삭제(purge) 전에 정리한다.
-- 프로젝트는 deleted_at만 본다(보관 archived_at은 무관). purge_project가 소프트 삭제 상태만 받으므로 순서가 맞는다.
create function public.can_remove_file_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.files f
    where f.storage_path = p_name
      and public.can_view_project(f.project_id)
      and ((f.deleted_at is null and f.status in ('pending', 'failed')
            and (f.uploaded_by = auth.uid() or public.can_edit_project(f.project_id)))
           or ((f.deleted_at is not null
                or exists (select 1 from public.projects pr where pr.id = f.project_id and pr.deleted_at is not null))
               and public.can_manage_project(f.project_id)))
  );
$$;

-- anon·public에서는 실행 권한을 거두고 authenticated에만 준다.
-- Supabase 기본 권한이 새 함수를 anon에도 열어 두기 때문에 명시적으로 revoke한다.
revoke execute on function
  public.is_ws_member(uuid),
  public.ws_role(uuid),
  public.is_ws_admin(uuid),
  public.project_perm(uuid),
  public.can_view_project(uuid),
  public.can_comment_project(uuid),
  public.can_edit_project(uuid),
  public.can_manage_project(uuid),
  public.project_is_live(uuid),
  public.can_view_project_rows(uuid),
  public.can_comment_project_rows(uuid),
  public.can_edit_project_rows(uuid),
  public.shares_workspace(uuid),
  public.task_project_id(uuid),
  public.comment_project_id(uuid),
  public.can_read_file_object(text),
  public.can_upload_file_object(text),
  public.can_remove_file_object(text)
from public, anon;

grant execute on function
  public.is_ws_member(uuid),
  public.ws_role(uuid),
  public.is_ws_admin(uuid),
  public.project_perm(uuid),
  public.can_view_project(uuid),
  public.can_comment_project(uuid),
  public.can_edit_project(uuid),
  public.can_manage_project(uuid),
  public.project_is_live(uuid),
  public.can_view_project_rows(uuid),
  public.can_comment_project_rows(uuid),
  public.can_edit_project_rows(uuid),
  public.shares_workspace(uuid),
  public.task_project_id(uuid),
  public.comment_project_id(uuid),
  public.can_read_file_object(text),
  public.can_upload_file_object(text),
  public.can_remove_file_object(text)
to authenticated;

-- 다른 사용자 기준 권한은 내부 함수만 쓴다
revoke execute on function private.project_perm_for(uuid, uuid) from public, anon, authenticated;
