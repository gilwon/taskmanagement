-- 즐겨찾기 대상의 워크스페이스 일치·조회 권한과 작업·서브태스크 담당자의 워크스페이스 소속을 강제한다.
-- 서브태스크 변환은 배정할 수 없는 담당자를 비우고 진행하도록 바꾼다.
--
-- 새 오류 코드(errcode 'P0001', rpc 마이그레이션의 오류 규약에 더한다).
--   invalid_assignee  담당자가 그 워크스페이스의 구성원이 아니거나 비활성(deactivated) 구성원이다
-- 즐겨찾기 대상을 볼 수 없으면(없는 id 포함) RLS 거부(42501)로 올라온다. 존재 여부는 새지 않는다.

-- ─────────────────────────────────────────────
-- 즐겨찾기. 대상 작업·프로젝트가 같은 워크스페이스에 있어야 한다
-- ─────────────────────────────────────────────
-- favorites 복합 FK 대상(projects에는 01에서 이미 있다)
alter table public.tasks add constraint tasks_id_workspace_id_key unique (id, workspace_id);

-- 단일 키 FK는 다른 워크스페이스 작업·프로젝트도 받아 준다. 복합 FK로 바꾼다.
-- match simple이라 null인 쪽(project_id 또는 task_id)은 검사하지 않는다.
-- 첫 컬럼 인덱스는 01의 favorites_project_id_idx·favorites_task_id_idx가 이미 있다.
alter table public.favorites
  drop constraint favorites_project_id_fkey,
  drop constraint favorites_task_id_fkey,
  add constraint favorites_project_workspace_fkey
    foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  add constraint favorites_task_workspace_fkey
    foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade;

-- 볼 수 없는 작업·프로젝트는 즐겨찾기할 수 없다.
-- RLS with check가 FK 검사(문장 끝 트리거)보다 먼저 돌기 때문에 없는 id도 42501로 떨어진다.
drop policy favorites_owner on public.favorites;
create policy favorites_owner on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_ws_member(workspace_id)
              and (project_id is null or public.can_view_project(project_id))
              and (task_id is null or public.can_view_project(public.task_project_id(task_id))));

-- ─────────────────────────────────────────────
-- 담당자 소속 검사
-- ─────────────────────────────────────────────
-- 새로 배정하는 담당자는 그 워크스페이스의 active 또는 invited 구성원이어야 한다.
-- invited를 허용하는 이유. 앱 담당자 선택 목록이 active·invited를 보여 주고,
-- 초대된 사람이 수락하는 즉시 미리 배정된 일을 받게 하기 위해서다. deactivated와 구성원 행이 없는 사람은 거부한다.
-- 담당자가 바뀔 때만 검사하므로 비활성화 전에 배정된 담당자는 그대로 남는다(기존 배정 유지).
-- 반복 다음 회차(spawn_next_occurrence)가 원본 담당자를 그대로 옮기는 것도 기존 배정 유지로 보고 통과시킨다.
-- recur_source_id는 클라이언트 insert에서 guard_task_insert가 지우므로 이 예외로 검사를 피할 수 없다.
-- auth.uid()가 없는 시드·관리 작업에도 같은 규칙을 적용한다.
-- definer 사유. 구성원 상태 판정은 workspace_members RLS(보는 사람 기준)와 무관하게 해야 한다.
create function public.guard_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
begin
  if new.assignee_id is null
     or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then
    return new;
  end if;

  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' and new.recur_source_id is not null
       and new.assignee_id = (select t.assignee_id from public.tasks t where t.id = new.recur_source_id) then
      return new;
    end if;
    v_ws := new.workspace_id;
  else
    select t.workspace_id into v_ws from public.tasks t where t.id = new.task_id;
  end if;

  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = v_ws and m.user_id = new.assignee_id and m.status in ('active', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_assignee';
  end if;
  return new;
end;
$$;

-- BEFORE 트리거는 이름순으로 돈다. tasks_guard_insert(workspace_id 채움, 클라이언트 recur_source_id 제거)
-- 다음에 돌아야 하므로 이름을 tasks_validate_*로 둔다.
create trigger tasks_validate_assignee
  before insert or update of assignee_id on public.tasks
  for each row execute function public.guard_task_assignee();

create trigger subtasks_validate_assignee
  before insert or update of assignee_id on public.subtasks
  for each row execute function public.guard_task_assignee();

-- 트리거 함수는 직접 호출할 일이 없다.
revoke execute on function public.guard_task_assignee() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 서브태스크 → 작업 변환(rpc 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. 서브태스크 담당자가 그 워크스페이스에서 배정할 수 없는 사람(행 없음 또는 deactivated)이면
-- 새 작업 담당자를 비우고 변환은 성공시킨다. 그대로 넘기면 guard_task_assignee가 invalid_assignee로 막는다.
-- 나머지 동작은 rpc 마이그레이션과 같다.
-- create_task를 재사용하고(활동 created는 트리거), 서브태스크를 지운 뒤 부모 작업에 활동을 남긴다.
-- 서브태스크 메모는 평문이라 HTML 특수문자를 이스케이프해 설명 문단으로 옮긴다.
-- definer 사유. 활동 converted a subtask of는 클라이언트가 넣을 수 없고 대응하는 트리거 이벤트도 없다.
-- 함수 안에서 auth.uid()와 편집 권한, 작업·프로젝트 삭제 상태를 직접 확인한다.
create or replace function public.convert_subtask(p_subtask uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.subtasks;
  v_parent public.tasks;
  v_new public.tasks;
  v_desc text;
  v_assignee uuid;
begin
  perform private.require_uid();
  select * into v_s from public.subtasks s where s.id = p_subtask;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  select * into v_parent from public.tasks t where t.id = v_s.task_id;
  if v_parent.deleted_at is not null or not public.can_view_project_rows(v_parent.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_edit_project_rows(v_parent.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if btrim(coalesce(v_s.note, '')) <> '' then
    v_desc := '<p>' || replace(replace(replace(v_s.note, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>';
  end if;

  -- guard_task_assignee와 같은 기준(active·invited만 배정 가능)
  select m.user_id into v_assignee from public.workspace_members m
  where m.workspace_id = v_parent.workspace_id and m.user_id = v_s.assignee_id
    and m.status in ('active', 'invited');

  v_new := public.create_task(
    v_parent.project_id, v_s.title, 'todo', 'medium', v_assignee, null, v_s.due_date,
    '{}', v_desc, null, 'none', null
  );

  delete from public.subtasks s where s.id = p_subtask;

  perform private.log_activity(v_parent.project_id, v_parent.id, 'converted a subtask of',
    jsonb_build_object('subtask_title', v_s.title, 'new_task_id', v_new.id, 'new_task_key', v_new.key));

  return v_new;
end;
$$;

revoke execute on function public.convert_subtask(uuid) from public, anon;
grant execute on function public.convert_subtask(uuid) to authenticated;
