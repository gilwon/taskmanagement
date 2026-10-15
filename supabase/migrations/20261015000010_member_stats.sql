-- 구성원 표의 "참여 프로젝트"·"열린 작업" 열을 한 번의 집계로 돌려준다(META members 표 Active projects/Tasks).
-- 구성원마다 작업을 따로 세면 N+1이 되고, 작업 행을 앱으로 가져와 세면 PostgREST max_rows(1000)에서 잘린다.
--
-- 기준. 삭제·보관되지 않은 작업 중 그 사람이 담당자인 것만 센다(삭제·보관된 프로젝트의 작업도 뺀다).
--   project_count  담당 작업이 있는 프로젝트 수(완료 작업 포함, 구성원 프로필의 "참여 프로젝트"와 같다)
--   task_count     담당 작업 중 완료되지 않은 것의 수
-- security invoker. tasks·projects의 RLS가 그대로 걸려 부른 사람이 볼 수 있는 작업만 센다.

create function public.workspace_member_stats(p_workspace uuid)
returns table (user_id uuid, project_count integer, task_count integer)
language sql
stable
set search_path = ''
as $$
  select t.assignee_id,
         count(distinct t.project_id)::integer,
         (count(*) filter (where t.status <> 'done'))::integer
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.workspace_id = p_workspace
    and t.assignee_id is not null
    and t.deleted_at is null and t.archived_at is null
    and p.deleted_at is null and p.archived_at is null
  group by t.assignee_id
$$;

revoke execute on function public.workspace_member_stats(uuid) from public, anon;
grant execute on function public.workspace_member_stats(uuid) to authenticated;
