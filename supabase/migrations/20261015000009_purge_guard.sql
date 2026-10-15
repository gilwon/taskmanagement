-- 영구 삭제가 Storage 객체를 고아로 남기지 않게 한다.
-- purge_project·purge_file이 지울 행에 딸린 객체가 storage.objects에 남아 있으면 files_remain으로 거부한다.
-- storage.objects는 SQL로 지울 수 없으므로(protect_objects_delete 트리거) 앱이 Storage API로 먼저 지워야 한다.
-- 오류 코드 files_remain은 org 마이그레이션(008)에서 정했다. 본문은 rpc 마이그레이션(004)과 같고 객체 확인만 더한다.

-- 프로젝트를 지우면 하위 행은 cascade로 지워지지만 Storage 객체는 남는다.
-- 앱 순서. soft_delete_project → 그 프로젝트 files 행의 storage_path 객체를 Storage API로 삭제 → purge_project
-- (소프트 삭제된 프로젝트의 객체는 can_manage_project가 지울 수 있다. can_remove_file_object).
-- 보관만 된 프로젝트는 객체를 정리할 수 없으므로 받지 않는다(invalid_state).
-- definer 사유. projects에는 클라이언트 delete 권한이 없고, 남은 객체 확인에 storage.objects를 읽어야 한다.
create or replace function public.purge_project(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects;
begin
  perform private.require_uid();
  select * into v_p from public.projects pr where pr.id = p_project;
  if not found or not public.can_view_project(p_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_manage_project(p_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_p.deleted_at is null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  -- 경로 규칙 {workspace_id}/{project_id}/{file_id}/{object_name}. uuid에는 like 특수문자가 없다
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'files' and o.name like v_p.workspace_id::text || '/' || p_project::text || '/%'
  ) then
    raise exception using errcode = 'P0001', message = 'files_remain';
  end if;
  delete from public.projects pr where pr.id = p_project;
end;
$$;

-- 메타데이터 행만 지운다. Storage 객체는 앱이 먼저 Storage API로 지운다(객체 삭제 정책이 이 행을 근거로 한다).
-- definer 사유. files에는 클라이언트 delete 권한이 없고, 남은 객체 확인에 storage.objects를 읽어야 한다.
create or replace function public.purge_file(p_file uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
begin
  perform private.require_uid();
  v_f := private.require_file_visible(p_file);
  if not public.can_manage_project(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  if v_f.deleted_at is null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'files' and o.name = v_f.storage_path) then
    raise exception using errcode = 'P0001', message = 'files_remain';
  end if;
  delete from public.files f where f.id = p_file;
end;
$$;

revoke execute on function public.purge_project(uuid), public.purge_file(uuid) from public, anon;
grant execute on function public.purge_project(uuid), public.purge_file(uuid) to authenticated;
