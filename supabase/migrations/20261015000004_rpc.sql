-- 작업 키 발급·값 위조 방지 트리거, 활동·알림 기록 트리거, 여러 행이 함께 바뀌는 동작을 처리하는 RPC를 만든다.
--
-- 오류 규약. 모두 errcode 'P0001'이고 message가 앱이 한국어 문구로 바꿀 고정 코드다.
--   unauthenticated   auth.uid()가 없다
--   forbidden         권한이 없다
--   not_found         대상이 없거나 볼 권한이 없다
--   project_deleted   프로젝트가 삭제 상태라 하위 항목을 바꿀 수 없다
--   invalid_input     입력값 형식이 틀렸다(빈 이름, 모르는 템플릿, 잘못된 이메일 등)
--   slug_invalid      워크스페이스 URL 형식이 틀렸다
--   slug_taken        워크스페이스 URL이 이미 쓰이고 있다
--   key_exhausted     프로젝트 키 후보를 더 만들 수 없다
--   conflict          복원 토큰이 다르거나(다른 사용자가 바꿈) 이미 처리된 상태다
--   invalid_state     지금 상태에서 할 수 없는 동작이다(보관함에 없는 항목 영구 삭제, ready 파일 실패 처리 등)
--   upload_incomplete 파일 행에 해당하는 Storage 객체가 없다
--   size_mismatch     Storage 객체 크기가 파일 행의 size_bytes와 다르다
--   self_role_change  자기 역할·상태를 바꾸려 했다(rls 마이그레이션 트리거)
--   owner_only        owner 관련 변경을 owner가 아닌 사람이 했다(rls 마이그레이션 트리거)
--   last_owner        마지막 owner를 없애려 했다(rls 마이그레이션 트리거)
-- 그 밖에 check 제약 위반(23514), 외래키 위반(23503), RLS·권한 거부(42501)는 Postgres 기본 코드로 올라온다.
--
-- RPC는 기본 security invoker라 RLS를 그대로 받는다. definer가 필요한 함수는 각 함수에 사유를 적었다.
--
-- 활동(activities)과 알림(notifications)은 클라이언트가 직접 넣을 수 없다.
-- tasks·subtasks·task_deps·comments·files·projects의 AFTER 트리거(definer)가 서버 값으로 기록한다.
-- 트리거는 auth.uid()가 null이면(시드·관리 작업) 아무것도 기록하지 않는다. 시드는 활동을 직접 넣는다.

-- ─────────────────────────────────────────────
-- 내부 함수(private 스키마는 auth_helpers 마이그레이션에서 만든다)
-- ─────────────────────────────────────────────

-- 로그인 사용자 id를 돌려주고 없으면 오류
create function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  return v_uid;
end;
$$;

-- 활동 한 건을 현재 사용자 이름으로 남긴다. auth.uid()가 없으면 남기지 않는다.
-- 권한 판단은 하지 않는다. 호출자는 이미 RLS를 통과한 쓰기 뒤에 도는 definer 트리거와 definer RPC뿐이고,
-- 클라이언트 역할에는 실행 권한을 주지 않는다.
create function private.log_activity(p_project uuid, p_task uuid, p_verb text, p_extra jsonb default '{}')
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
begin
  if v_uid is null then
    return;
  end if;
  select pr.workspace_id into v_ws from public.projects pr where pr.id = p_project;
  insert into public.activities (workspace_id, project_id, task_id, actor_id, verb, extra)
  values (v_ws, p_project, p_task, v_uid, p_verb, coalesce(p_extra, '{}'));
end;
$$;

-- HTML 태그를 지우고 공백을 줄인 평문 발췌(최대 140자)
create function private.plain_snippet(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 140);
$$;

-- 알림 한 건을 서버 문구로 만든다. 본인에게는 보내지 않고, 수신자가 그 프로젝트를 볼 수 없으면 보내지 않는다.
-- 실제로 보냈으면 true. 클라이언트 역할에는 실행 권한을 주지 않는다.
create function private.notify(
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
  insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet)
  values (p_user, v_ws, p_type, v_uid, p_task, p_project, p_text, p_snippet);
  return true;
end;
$$;

-- 프로젝트 seq를 1 올려 돌려준다. update가 프로젝트 행을 잠가 트랜잭션이 끝날 때까지
-- 같은 프로젝트의 다른 발급을 기다리게 하므로 동시 요청에서도 번호가 겹치지 않는다.
-- definer 사유. 클라이언트는 projects.seq를 바꿀 수 없고(projects_guard), 편집 권한만으로
-- projects 행 update 권한이 보장되지도 않는다. 함수 안에서 can_edit_project_rows를 직접 확인한다.
-- 클라이언트 insert의 키 발급 트리거가 authenticated로 이 함수를 불러야 해서 실행 권한은 남기고
-- PostgREST가 노출하지 않는 private 스키마에 둔다.
create function private.next_task_seq(p_project uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  perform private.require_uid();
  if not public.can_edit_project_rows(p_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.projects set seq = seq + 1 where id = p_project returning seq into v_seq;
  if v_seq is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return v_seq;
end;
$$;

-- 작업 insert 직전 처리
-- 클라이언트(authenticated)가 넣은 key·created_by·recur_source_id·completed_at·prev_status·deleted_at·archived_at은
-- 무시하고 서버 값으로 덮는다. 반복 회차 연결은 spawn_next_occurrence만 만든다.
-- key가 비어 있으면 {프로젝트 키}-{seq}로 채운다. postgres(시드)가 key를 직접 넣은 경우에만 그대로 둔다.
create function public.guard_task_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_seq int;
  v_key text;
  v_ws uuid;
begin
  if current_user = 'authenticated' then
    new.key := null;
    new.created_by := auth.uid();
    new.recur_source_id := null;
    new.prev_status := null;
    new.deleted_at := null;
    new.archived_at := null;
    new.completed_at := case when new.status = 'done' then clock_timestamp() end;
  end if;
  if new.key is null then
    v_seq := private.next_task_seq(new.project_id);
    select pr.key, pr.workspace_id into v_key, v_ws from public.projects pr where pr.id = new.project_id;
    new.key := v_key || '-' || v_seq;
    new.workspace_id := coalesce(new.workspace_id, v_ws);
  end if;
  return new;
end;
$$;

create trigger tasks_guard_insert
  before insert on public.tasks
  for each row execute function public.guard_task_insert();

-- ─────────────────────────────────────────────
-- 활동·알림 기록 트리거
-- definer 사유. activities·notifications에는 클라이언트 insert 정책이 없다.
-- 모든 트리거는 auth.uid()가 null이면 아무것도 하지 않는다(private.log_activity·private.notify가 걸러 낸다).
-- ─────────────────────────────────────────────

-- 작업 생성·수정. META §4 verb로 바뀐 속성마다 한 건씩 남기고, 새 담당자에게 assign 알림을 보낸다.
-- 반복 작업이 done으로 바뀌면 다음 회차도 여기서 만든다(auth.uid()가 없는 시드에서는 만들지 않는다).
-- 상태가 done으로 들어가면 completed, 그 밖의 상태 변경은 moved(extra.from, extra.to)다.
create function public.on_task_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform private.log_activity(new.project_id, new.id, 'created');
    perform private.notify(new.assignee_id, 'assign', new.project_id, new.id,
                           '회원님을 담당자로 지정했습니다', null);
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      perform private.log_activity(new.project_id, new.id, 'completed',
                                   jsonb_build_object('from', old.status, 'to', new.status));
      -- 반복 작업은 어느 경로(complete_task·move_task·직접 update)로 done이 되든 다음 회차를 만든다.
      -- recur_source_id unique라 다시 done이 되어도 회차는 하나뿐이다.
      if new.recur <> 'none' and new.deleted_at is null then
        perform private.spawn_next_occurrence(new.id);
      end if;
    else
      perform private.log_activity(new.project_id, new.id, 'moved',
                                   jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform private.log_activity(new.project_id, new.id, 'assigned',
                                 jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    perform private.notify(new.assignee_id, 'assign', new.project_id, new.id,
                           '회원님을 담당자로 지정했습니다', null);
  end if;
  if new.priority is distinct from old.priority then
    perform private.log_activity(new.project_id, new.id, 'changed priority of',
                                 jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.due_date is distinct from old.due_date then
    perform private.log_activity(new.project_id, new.id, 'changed due date of',
                                 jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.start_date is distinct from old.start_date then
    perform private.log_activity(new.project_id, new.id, 'changed start date of',
                                 jsonb_build_object('from', old.start_date, 'to', new.start_date));
  end if;
  if new.labels is distinct from old.labels then
    perform private.log_activity(new.project_id, new.id, 'updated labels on',
                                 jsonb_build_object('from', old.labels, 'to', new.labels));
  end if;
  if new.title is distinct from old.title then
    perform private.log_activity(new.project_id, new.id, 'renamed',
                                 jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.recur is distinct from old.recur then
    perform private.log_activity(new.project_id, new.id, 'set repeat on', jsonb_build_object('to', new.recur));
  end if;
  if new.estimate is distinct from old.estimate then
    perform private.log_activity(new.project_id, new.id, 'estimated', jsonb_build_object('to', new.estimate));
  end if;
  if old.archived_at is null and new.archived_at is not null then
    perform private.log_activity(new.project_id, new.id, 'archived');
  end if;
  if (old.archived_at is not null and new.archived_at is null)
     or (old.deleted_at is not null and new.deleted_at is null) then
    perform private.log_activity(new.project_id, new.id, 'restored');
  end if;
  return null;
end;
$$;

create trigger tasks_log
  after insert or update on public.tasks
  for each row execute function public.on_task_written();

-- 서브태스크 추가·완료·재개·담당자·기한
create function public.on_subtask_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_extra jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_project := public.task_project_id(new.task_id);
  v_extra := jsonb_build_object('subtask_id', new.id, 'title', new.title);

  if tg_op = 'INSERT' then
    perform private.log_activity(v_project, new.task_id, 'added subtask to', v_extra);
    return null;
  end if;
  if new.done and not old.done then
    perform private.log_activity(v_project, new.task_id, 'completed subtask on', v_extra);
  elsif old.done and not new.done then
    perform private.log_activity(v_project, new.task_id, 'reopened subtask on', v_extra);
  end if;
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform private.log_activity(v_project, new.task_id, 'assigned a subtask on',
                                 v_extra || jsonb_build_object('to', new.assignee_id));
  end if;
  if new.due_date is distinct from old.due_date then
    perform private.log_activity(v_project, new.task_id, 'set a subtask due date on',
                                 v_extra || jsonb_build_object('to', new.due_date));
  end if;
  return null;
end;
$$;

create trigger subtasks_log
  after insert or update on public.subtasks
  for each row execute function public.on_subtask_written();

-- 의존성 추가·삭제. 작업 영구 삭제로 cascade 삭제될 때는 작업이 이미 없으므로 남기지 않는다.
create function public.on_task_dep_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_project uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_project := public.task_project_id(v_task);
  if v_project is null then
    return null;
  end if;
  perform private.log_activity(v_project, v_task, 'updated dependencies of',
    case when tg_op = 'INSERT' then jsonb_build_object('added', new.blocked_by_id)
         else jsonb_build_object('removed', old.blocked_by_id) end);
  return null;
end;
$$;

create trigger task_deps_log
  after insert or delete on public.task_deps
  for each row execute function public.on_task_dep_written();

-- 댓글 작성. 활동 commented on과 작업 담당자에게 comment 알림(본인 제외)
create function public.on_comment_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_assignee uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  select t.project_id, t.assignee_id into v_project, v_assignee from public.tasks t where t.id = new.task_id;
  perform private.log_activity(v_project, new.task_id, 'commented on', jsonb_build_object('comment_id', new.id));
  perform private.notify(v_assignee, 'comment', v_project, new.task_id,
                         '회원님의 작업에 댓글을 남겼습니다', private.plain_snippet(new.body));
  return null;
end;
$$;

create trigger comments_log
  after insert on public.comments
  for each row execute function public.on_comment_inserted();

-- 파일 업로드 완료(ready)와 소프트 삭제
create function public.on_file_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_extra jsonb := jsonb_build_object('file_id', new.id, 'name', new.name);
begin
  if auth.uid() is null then
    return null;
  end if;
  if new.status = 'ready' and old.status <> 'ready' then
    perform private.log_activity(new.project_id, new.task_id, 'added a file to', v_extra);
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform private.log_activity(new.project_id, new.task_id, 'removed a file from', v_extra);
  end if;
  return null;
end;
$$;

create trigger files_log
  after update on public.files
  for each row execute function public.on_file_written();

-- 프로젝트 생성·상태 변경·보관·복원
create function public.on_project_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_activity(new.id, null, 'created project');
    return null;
  end if;
  if new.status is distinct from old.status then
    perform private.log_activity(new.id, null, 'changed status of project',
                                 jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if old.archived_at is null and new.archived_at is not null then
    perform private.log_activity(new.id, null, 'archived');
  end if;
  if (old.archived_at is not null and new.archived_at is null)
     or (old.deleted_at is not null and new.deleted_at is null) then
    perform private.log_activity(new.id, null, 'restored');
  end if;
  return null;
end;
$$;

create trigger projects_log
  after insert or update on public.projects
  for each row execute function public.on_project_written();

-- ─────────────────────────────────────────────
-- 프로젝트 생성
-- ─────────────────────────────────────────────
-- definer 사유. projects에는 insert 정책이 없고(생성 경로를 이 함수로 고정),
-- 생성자를 project_members full로 넣으려면 아직 없는 관리 권한이 필요하다.
-- 함수 안에서 auth.uid()와 워크스페이스 역할(guest가 아닌 active 구성원)을 직접 확인한다.
--
-- 키 규칙(META §4). 공백으로 나눈 단어 중 영문자로 시작하는 단어의 첫 글자를 대문자로 최대 3자 잇는다.
-- 영문 단어가 없으면 'P'. 같은 워크스페이스에 이미 있으면 뒤에 'X'를 붙여 비는 키를 찾는다(최대 10자).
-- 동시에 같은 키를 만들면 unique(workspace_id, key) 위반(23505)으로 한쪽이 실패한다.
create function public.create_project(
  p_workspace uuid,
  p_name text,
  p_icon text default 'folder',
  p_color text default 'indigo',
  p_access public.project_access default 'workspace',
  p_template text default 'blank',
  p_status public.project_status default 'planning',
  p_team uuid default null,
  p_lead uuid default null,
  p_start date default null,
  p_due date default null,
  p_description text default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_role public.ws_role := public.ws_role(p_workspace);
  v_name text := btrim(coalesce(p_name, ''));
  v_key text;
  v_project public.projects;
begin
  if v_role is null or v_role = 'guest' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_name = '' then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;
  if coalesce(p_template, 'blank') not in ('blank', 'product', 'web', 'mkt', 'design', 'software', 'personal') then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;

  select string_agg(upper(left(w.word, 1)), '' order by w.n) into v_key
  from (
    select t.word, t.n
    from regexp_split_to_table(v_name, '\s+') with ordinality as t(word, n)
    where t.word ~ '^[A-Za-z]'
    order by t.n
    limit 3
  ) w;
  v_key := coalesce(v_key, 'P');
  while exists (select 1 from public.projects pr where pr.workspace_id = p_workspace and pr.key = v_key) loop
    if char_length(v_key) >= 10 then
      raise exception using errcode = 'P0001', message = 'key_exhausted';
    end if;
    v_key := v_key || 'X';
  end loop;

  -- 활동 created project는 projects_log 트리거가 남긴다
  insert into public.projects (
    workspace_id, key, name, icon, color, status, team_id, lead_id, start_date, due_date,
    description, access, created_by
  ) values (
    p_workspace, v_key, v_name, coalesce(p_icon, 'folder'), coalesce(p_color, 'indigo'), coalesce(p_status, 'planning'),
    p_team, p_lead, p_start, p_due, p_description, coalesce(p_access, 'workspace'), v_uid
  )
  returning * into v_project;

  insert into public.project_members (project_id, user_id, perm) values (v_project.id, v_uid, 'full');

  -- 템플릿 starter task. 키는 guard_task_insert 트리거가 201부터 발급하고 활동 created도 트리거가 남긴다.
  insert into public.tasks (workspace_id, project_id, key, title, status, priority, sort_order, created_by)
  select p_workspace, v_project.id, null, s.title, s.status::public.task_status, s.priority::public.task_priority,
         s.n * 1000, v_uid
  from (values
    ('product', 1, '제품 목표와 성공 지표 정하기', 'todo', 'high'),
    ('product', 2, '사용자 인터뷰 진행', 'todo', 'medium'),
    ('product', 3, '요구사항 문서 작성', 'backlog', 'high'),
    ('product', 4, 'MVP 범위 확정', 'backlog', 'medium'),
    ('product', 5, '출시 일정 계획', 'backlog', 'low'),
    ('web', 1, '사이트맵 정리', 'todo', 'high'),
    ('web', 2, '와이어프레임 작성', 'todo', 'medium'),
    ('web', 3, '디자인 시안 검토', 'backlog', 'medium'),
    ('web', 4, '반응형 레이아웃 구현', 'backlog', 'high'),
    ('web', 5, '출시 전 품질 점검', 'backlog', 'medium'),
    ('mkt', 1, '캠페인 목표 설정', 'todo', 'high'),
    ('mkt', 2, '타깃 고객 정의', 'todo', 'medium'),
    ('mkt', 3, '채널별 콘텐츠 기획', 'backlog', 'medium'),
    ('mkt', 4, '광고 소재 제작', 'backlog', 'medium'),
    ('mkt', 5, '성과 측정 지표 정리', 'backlog', 'low'),
    ('design', 1, '디자인 브리프 작성', 'todo', 'high'),
    ('design', 2, '레퍼런스 수집', 'todo', 'medium'),
    ('design', 3, '초안 시안 제작', 'backlog', 'medium'),
    ('design', 4, '피드백 반영', 'backlog', 'medium'),
    ('design', 5, '최종 산출물 전달', 'backlog', 'low'),
    ('software', 1, '개발 환경 구성', 'todo', 'high'),
    ('software', 2, '기술 설계 문서 작성', 'todo', 'medium'),
    ('software', 3, '핵심 기능 구현', 'backlog', 'high'),
    ('software', 4, '테스트 작성', 'backlog', 'medium'),
    ('software', 5, '배포 파이프라인 구성', 'backlog', 'medium'),
    ('software', 6, '출시 회고', 'backlog', 'low'),
    ('personal', 1, '목표 적어 보기', 'todo', 'medium'),
    ('personal', 2, '할 일 목록 정리', 'todo', 'medium'),
    ('personal', 3, '이번 주 우선순위 정하기', 'backlog', 'high'),
    ('personal', 4, '진행 상황 돌아보기', 'backlog', 'low')
  ) as s(template, n, title, status, priority)
  where s.template = coalesce(p_template, 'blank')
  order by s.n;

  return v_project;
end;
$$;

-- ─────────────────────────────────────────────
-- 온보딩
-- ─────────────────────────────────────────────
-- definer 사유. 호출자는 아직 어느 워크스페이스의 구성원도 아니라 workspaces·workspace_members에
-- insert할 정책이 없다. 함수 안에서 auth.uid()를 확인하고 owner는 호출자 자신만 될 수 있다.
create function public.create_workspace_onboarding(
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
-- 작업 생성·이동·완료·재개
-- ─────────────────────────────────────────────

-- 편집 대상 작업을 읽고 권한을 확인한다. definer 함수(삭제·복원)에서도 쓰므로 RLS에 기대지 않고
-- 조회 권한을 직접 본다. 삭제된 작업은 p_allow_deleted일 때만 대상이 된다(삭제·복원용).
create function private.require_task_edit(p_task uuid, p_allow_deleted boolean default false)
returns public.tasks
language plpgsql
stable
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  select * into v_t from public.tasks t where t.id = p_task;
  if not found or not public.can_view_project_rows(v_t.project_id)
     or (v_t.deleted_at is not null and not p_allow_deleted) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_edit_project(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  return v_t;
end;
$$;

-- 정렬값을 주지 않으면 같은 상태 열의 맨 뒤(+1000)에 둔다. 활동 created는 tasks_log 트리거가 남긴다.
create function public.create_task(
  p_project uuid,
  p_title text,
  p_status public.task_status default 'todo',
  p_priority public.task_priority default 'medium',
  p_assignee uuid default null,
  p_start date default null,
  p_due date default null,
  p_labels text[] default '{}',
  p_desc text default null,
  p_estimate text default null,
  p_recur public.repeat_kind default 'none',
  p_sort_order numeric default null
)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_ws uuid;
  v_status public.task_status := coalesce(p_status, 'todo');
  v_sort numeric;
  v_task public.tasks;
begin
  select pr.workspace_id into v_ws from public.projects pr where pr.id = p_project and pr.deleted_at is null;
  if v_ws is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_edit_project(p_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;

  v_sort := coalesce(
    p_sort_order,
    (select coalesce(max(t.sort_order), 0) + 1000 from public.tasks t
     where t.project_id = p_project and t.status = v_status)
  );

  insert into public.tasks (
    workspace_id, project_id, key, title, status, priority, assignee_id, start_date, due_date,
    labels, description_html, estimate, recur, sort_order, created_by, completed_at
  ) values (
    v_ws, p_project, null, btrim(p_title), v_status, coalesce(p_priority, 'medium'), p_assignee, p_start, p_due,
    coalesce(p_labels, '{}'), p_desc, p_estimate, coalesce(p_recur, 'none'), v_sort, v_uid,
    case when v_status = 'done' then clock_timestamp() end
  )
  returning * into v_task;

  return v_task;
end;
$$;

-- 보드 열 이동. 활동 moved·completed, completed_at·prev_status, 반복 회차는 트리거가 처리한다.
create function public.move_task(
  p_task uuid,
  p_status public.task_status,
  p_sort_order numeric default null
)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  v_new public.tasks;
begin
  perform private.require_uid();
  perform private.require_task_edit(p_task);
  update public.tasks t set
    status = p_status,
    sort_order = coalesce(p_sort_order, t.sort_order)
  where t.id = p_task
  returning * into v_new;
  return v_new;
end;
$$;

-- 반복 작업의 다음 회차를 recur_source_id = p_task로 하나만 만들고 돌려준다. 이미 있으면 기존 회차를 돌려준다.
-- definer 사유. 클라이언트 insert는 recur_source_id를 지우므로(guard_task_insert) 회차 연결은
-- 함수 소유자 권한으로만 만든다. 함수 안에서 auth.uid()와 편집 권한, 원본 상태를 직접 확인한다.
-- 간격은 META 원본대로 daily 1, weekly 7, biweekly 14, monthly 30일이고 start·due를 같이 옮긴다.
create function private.spawn_next_occurrence(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_t public.tasks;
  v_next public.tasks;
  v_days int;
begin
  select * into v_t from public.tasks t where t.id = p_task;
  if not found or not public.can_view_project_rows(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_edit_project_rows(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_t.recur = 'none' or v_t.status <> 'done' or v_t.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;

  select * into v_next from public.tasks t where t.recur_source_id = p_task;
  if found then
    return v_next;
  end if;

  v_days := case v_t.recur
    when 'daily' then 1
    when 'weekly' then 7
    when 'biweekly' then 14
    when 'monthly' then 30
  end;

  insert into public.tasks (
    workspace_id, project_id, key, title, status, priority, assignee_id, start_date, due_date,
    labels, description_html, estimate, recur, sort_order, recur_source_id, created_by
  ) values (
    v_t.workspace_id, v_t.project_id, null, v_t.title, 'todo', v_t.priority, v_t.assignee_id,
    v_t.start_date + v_days, v_t.due_date + v_days,
    v_t.labels, v_t.description_html, v_t.estimate, v_t.recur, v_t.sort_order, p_task, v_uid
  )
  on conflict (recur_source_id) do nothing
  returning * into v_next;

  if v_next.id is null then
    select * into v_next from public.tasks t where t.recur_source_id = p_task;
  end if;
  return v_next;
end;
$$;

-- 완료. 상태만 done으로 바꾸고 다음 회차 정보를 돌려준다. 회차는 tasks_log 트리거가 만든다.
-- spawn_next_occurrence를 다시 부르는 것은 회차를 돌려받기 위해서다(이미 done이던 작업에 회차가 없으면 이때 만든다).
-- 원본 행을 for update로 잠그므로 같은 작업의 동시 완료는 직렬화되고,
-- recur_source_id unique + on conflict do nothing이 마지막 방어선이다.
-- 이미 완료된 작업을 다시 완료하면 상태가 바뀌지 않아 활동이 남지 않고 기존 회차 정보를 돌려준다.
create function public.complete_task(p_task uuid)
returns table (task_id uuid, next_task_id uuid, next_key text, next_title text, next_due date)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_t public.tasks;
  v_next public.tasks;
begin
  perform private.require_uid();
  perform private.require_task_edit(p_task);
  select * into v_t from public.tasks t where t.id = p_task for update;

  if v_t.status <> 'done' then
    update public.tasks t set status = 'done' where t.id = p_task;
  end if;
  if v_t.recur <> 'none' then
    v_next := private.spawn_next_occurrence(p_task);
  end if;

  return query select p_task, v_next.id, v_next.key, v_next.title, v_next.due_date;
end;
$$;

-- 완료 취소. prev_status(없으면 todo)로 되돌린다. 활동 moved는 트리거가 남긴다.
create function public.reopen_task(p_task uuid)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_new public.tasks;
begin
  perform private.require_uid();
  perform private.require_task_edit(p_task);
  select * into v_t from public.tasks t where t.id = p_task for update;
  if v_t.status <> 'done' then
    return v_t;
  end if;
  update public.tasks t set status = coalesce(v_t.prev_status, 'todo')
  where t.id = p_task
  returning * into v_new;
  return v_new;
end;
$$;

-- ─────────────────────────────────────────────
-- 소프트 삭제·복원·영구 삭제(tasks, projects, comments, files)
-- ─────────────────────────────────────────────
-- soft_delete_*는 삭제 시점 updated_at을 복원 토큰으로 돌려준다.
-- restore_*는 deleted_at이 있고 updated_at이 토큰과 같을 때만 복원한다. 다르면 conflict(META §6).
-- 토큰은 마이크로초까지 비교하므로 앱은 받은 문자열을 Date로 바꾸지 말고 그대로 돌려줘야 한다.
-- 권한은 호출 시점마다 다시 확인한다. 프로젝트가 삭제 상태면 하위 항목은 삭제·복원·영구 삭제하지 않는다.
-- definer 사유. 네 테이블의 deleted_at은 클라이언트가 직접 바꿀 수 없고(가드·컬럼 권한) 직접 delete 권한도 없다.
-- 휴지통(토큰 복원)과 영구 삭제 경로를 이 함수들로 고정한다. 함수 안에서 auth.uid()와 조회·편집·관리 권한,
-- 프로젝트 삭제 상태를 직접 확인한다. 볼 수 없는 대상은 not_found로 답해 존재를 드러내지 않는다.

create function public.soft_delete_task(p_task uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
  v_token timestamptz;
begin
  perform private.require_uid();
  v_t := private.require_task_edit(p_task, true);
  if v_t.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  update public.tasks t set deleted_at = clock_timestamp()
  where t.id = p_task and t.deleted_at is null
  returning t.updated_at into v_token;
  if v_token is null then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_token;
end;
$$;

create function public.restore_task(p_task uuid, p_token timestamptz)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  perform private.require_uid();
  perform private.require_task_edit(p_task, true);
  update public.tasks t set deleted_at = null
  where t.id = p_task and t.deleted_at is not null and t.updated_at = p_token
  returning * into v_t;
  if not found then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_t;
end;
$$;

create function public.purge_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.tasks;
begin
  perform private.require_uid();
  select * into v_t from public.tasks t where t.id = p_task;
  if not found or not public.can_view_project_rows(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_manage_project(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  if v_t.deleted_at is null and v_t.archived_at is null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  delete from public.tasks t where t.id = p_task;
end;
$$;

create function public.soft_delete_project(p_project uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token timestamptz;
begin
  perform private.require_uid();
  if not public.can_view_project(p_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_manage_project(p_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.projects pr set deleted_at = clock_timestamp()
  where pr.id = p_project and pr.deleted_at is null
  returning pr.updated_at into v_token;
  if v_token is null then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_token;
end;
$$;

create function public.restore_project(p_project uuid, p_token timestamptz)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects;
begin
  perform private.require_uid();
  if not public.can_view_project(p_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_manage_project(p_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.projects pr set deleted_at = null
  where pr.id = p_project and pr.deleted_at is not null and pr.updated_at = p_token
  returning * into v_p;
  if not found then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_p;
end;
$$;

-- 프로젝트를 지우면 하위 행은 cascade로 지워지지만 Storage 객체는 남는다.
-- 앱 순서. soft_delete_project → 그 프로젝트 files 행의 storage_path 객체를 Storage API로 삭제 → purge_project
-- (소프트 삭제된 프로젝트의 객체는 can_manage_project가 지울 수 있다. can_remove_file_object).
-- 보관만 된 프로젝트는 객체를 정리할 수 없으므로 받지 않는다(invalid_state).
create function public.purge_project(p_project uuid)
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
  delete from public.projects pr where pr.id = p_project;
end;
$$;

-- 댓글 삭제는 댓글 권한이 남아 있는 작성자 본인 또는 can_manage_project. 지운 사람은 deleted_by에 남긴다.
-- 복원은 can_manage_project 또는 자기가 지운 댓글의 작성자 본인
create function public.soft_delete_comment(p_comment uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_c public.comments;
  v_project uuid;
  v_token timestamptz;
begin
  select * into v_c from public.comments c where c.id = p_comment;
  v_project := public.task_project_id(v_c.task_id);
  if v_c.id is null or not public.can_view_project_rows(v_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_comment_project_rows(v_project)
     or not (v_c.author_id = v_uid or public.can_manage_project(v_project)) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.comments c set deleted_at = clock_timestamp(), deleted_by = v_uid
  where c.id = p_comment and c.deleted_at is null
  returning c.updated_at into v_token;
  if v_token is null then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_token;
end;
$$;

create function public.restore_comment(p_comment uuid, p_token timestamptz)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_c public.comments;
  v_project uuid;
begin
  select * into v_c from public.comments c where c.id = p_comment;
  v_project := public.task_project_id(v_c.task_id);
  if v_c.id is null or not public.can_view_project_rows(v_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  -- 작성자는 자기가 지운 댓글만 되살린다. 관리자가 지운 댓글(deleted_by가 다른 사람)은 관리자만 복원한다.
  if not public.can_comment_project_rows(v_project)
     or not (public.can_manage_project(v_project) or (v_c.author_id = v_uid and v_c.deleted_by = v_uid)) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.comments c set deleted_at = null, deleted_by = null
  where c.id = p_comment and c.deleted_at is not null and c.updated_at = p_token
  returning * into v_c;
  if not found then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_c;
end;
$$;

create function public.purge_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.comments;
  v_project uuid;
begin
  perform private.require_uid();
  select * into v_c from public.comments c where c.id = p_comment;
  v_project := public.task_project_id(v_c.task_id);
  if v_c.id is null or not public.can_view_project_rows(v_project) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_manage_project(v_project) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_project) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  if v_c.deleted_at is null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  delete from public.comments c where c.id = p_comment;
end;
$$;

-- 파일 행을 읽고 조회 권한을 확인한다(삭제·복원·영구 삭제용, definer 함수 안에서만 쓴다)
create function private.require_file_visible(p_file uuid)
returns public.files
language plpgsql
stable
set search_path = ''
as $$
declare
  v_f public.files;
begin
  select * into v_f from public.files f where f.id = p_file;
  if not found or not public.can_view_project_rows(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return v_f;
end;
$$;

create function public.soft_delete_file(p_file uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
  v_token timestamptz;
begin
  perform private.require_uid();
  v_f := private.require_file_visible(p_file);
  if not public.can_edit_project(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  update public.files f set deleted_at = clock_timestamp()
  where f.id = p_file and f.deleted_at is null
  returning f.updated_at into v_token;
  if v_token is null then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_token;
end;
$$;

create function public.restore_file(p_file uuid, p_token timestamptz)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
begin
  perform private.require_uid();
  v_f := private.require_file_visible(p_file);
  if not public.can_edit_project(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if not public.project_is_live(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'project_deleted';
  end if;
  update public.files f set deleted_at = null
  where f.id = p_file and f.deleted_at is not null and f.updated_at = p_token
  returning * into v_f;
  if not found then
    raise exception using errcode = 'P0001', message = 'conflict';
  end if;
  return v_f;
end;
$$;

-- 메타데이터 행만 지운다. Storage 객체는 앱이 먼저 Storage API로 지운다(객체 삭제 정책이 이 행을 근거로 한다).
create function public.purge_file(p_file uuid)
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
  delete from public.files f where f.id = p_file;
end;
$$;

-- ─────────────────────────────────────────────
-- 파일 업로드 상태 전이
-- ─────────────────────────────────────────────
-- 순서. 앱이 files 행(pending)을 만든다 → 같은 storage_path로 업로드한다 → finalize_file로 ready.
-- 업로드가 실패하면 fail_file로 failed, 다시 올리려면 retry_file로 pending에 돌린다.
-- definer 사유. files의 클라이언트 수정 권한에는 status가 없다. finalize_file은 클라이언트가 볼 수 없는
-- pending 객체의 metadata도 읽어야 한다. 함수 안에서 auth.uid()와 편집 권한, 프로젝트 삭제 상태를 직접 확인한다.

-- 파일 행을 읽고 편집 권한을 확인한다(definer 함수 안에서만 쓴다)
create function private.require_file_edit(p_file uuid)
returns public.files
language plpgsql
stable
set search_path = ''
as $$
declare
  v_f public.files;
begin
  select * into v_f from public.files f where f.id = p_file;
  if not found or not public.can_view_project_rows(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_edit_project_rows(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_f.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  return v_f;
end;
$$;

-- Storage 객체가 실제로 있고 metadata.size가 size_bytes와 같을 때만 ready로 바꾼다. 이미 ready면 그대로 돌려준다.
create function public.finalize_file(p_file uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
  v_size bigint;
begin
  perform private.require_uid();
  v_f := private.require_file_edit(p_file);
  if v_f.status = 'ready' then
    return v_f;
  end if;
  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'files' and o.name = v_f.storage_path;
  if not found then
    raise exception using errcode = 'P0001', message = 'upload_incomplete';
  end if;
  if v_size is distinct from v_f.size_bytes then
    raise exception using errcode = 'P0001', message = 'size_mismatch';
  end if;
  update public.files f set status = 'ready' where f.id = p_file returning * into v_f;
  return v_f;
end;
$$;

create function public.fail_file(p_file uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
begin
  perform private.require_uid();
  v_f := private.require_file_edit(p_file);
  if v_f.status = 'ready' then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  update public.files f set status = 'failed' where f.id = p_file returning * into v_f;
  return v_f;
end;
$$;

-- 실패한 업로드를 다시 올릴 수 있게 pending으로 돌린다. 원래 업로더 또는 can_manage_project만 한다.
-- 업로더는 그대로 둔다. 관리자가 대신 재시도할 때만 업로더를 관리자로 바꾼다(업로드 정책이 업로더 본인을 요구한다).
create function public.retry_file(p_file uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_f public.files;
begin
  v_f := private.require_file_edit(p_file);
  if v_f.uploaded_by is distinct from v_uid and not public.can_manage_project(v_f.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if v_f.status <> 'failed' then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;
  update public.files f set status = 'pending', uploaded_by = v_uid where f.id = p_file returning * into v_f;
  return v_f;
end;
$$;

-- ─────────────────────────────────────────────
-- 댓글 작성(멘션 알림 포함)
-- ─────────────────────────────────────────────
-- 댓글을 넣으면 comments_log 트리거가 활동 commented on과 담당자 comment 알림을 만든다.
-- 멘션 대상은 그 프로젝트를 볼 수 있는 사람에게만 mention 알림을 보낸다(본인 제외).
-- 담당자를 멘션하면 방금 만든 comment 알림을 mention으로 바꿔 알림이 두 개가 되지 않게 한다.
-- definer 사유. notifications에는 클라이언트 insert 정책이 없다. 함수 안에서 auth.uid()와
-- 댓글 권한, 작업·프로젝트 삭제 상태를 직접 확인하고 작성자는 호출자 자신으로 고정한다.
create function public.add_comment(p_task uuid, p_body text, p_mentions uuid[] default '{}')
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_t public.tasks;
  v_c public.comments;
  v_m uuid;
  v_snippet text;
begin
  select * into v_t from public.tasks t where t.id = p_task;
  if not found or v_t.deleted_at is not null or not public.can_view_project_rows(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if not public.can_comment_project_rows(v_t.project_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;

  insert into public.comments (task_id, author_id, body)
  values (p_task, v_uid, btrim(p_body))
  returning * into v_c;

  v_snippet := private.plain_snippet(v_c.body);
  for v_m in select distinct m from unnest(coalesce(p_mentions, '{}')) as m where m is not null loop
    if v_m = v_t.assignee_id then
      -- 이 트랜잭션(now())에 이 댓글로 만든 comment 알림 한 건만 바꾼다
      update public.notifications n set type = 'mention', text = '댓글에서 회원님을 멘션했습니다'
      where n.id = (
        select n2.id from public.notifications n2
        where n2.user_id = v_m and n2.task_id = p_task and n2.type = 'comment' and n2.actor_id = v_uid
          and n2.snippet is not distinct from v_snippet and n2.created_at = now()
        limit 1);
    else
      perform private.notify(v_m, 'mention', v_t.project_id, p_task, '댓글에서 회원님을 멘션했습니다', v_snippet);
    end if;
  end loop;

  return v_c;
end;
$$;

-- ─────────────────────────────────────────────
-- 서브태스크를 작업으로 변환
-- ─────────────────────────────────────────────
-- create_task를 재사용하고(활동 created는 트리거), 서브태스크를 지운 뒤 부모 작업에 활동을 남긴다.
-- 서브태스크 메모는 평문이라 HTML 특수문자를 이스케이프해 설명 문단으로 옮긴다.
-- definer 사유. 활동 converted a subtask of는 클라이언트가 넣을 수 없고 대응하는 트리거 이벤트도 없다.
-- 함수 안에서 auth.uid()와 편집 권한, 작업·프로젝트 삭제 상태를 직접 확인한다.
create function public.convert_subtask(p_subtask uuid)
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

  v_new := public.create_task(
    v_parent.project_id, v_s.title, 'todo', 'medium', v_s.assignee_id, null, v_s.due_date,
    '{}', v_desc, null, 'none', null
  );

  delete from public.subtasks s where s.id = p_subtask;

  perform private.log_activity(v_parent.project_id, v_parent.id, 'converted a subtask of',
    jsonb_build_object('subtask_title', v_s.title, 'new_task_id', v_new.id, 'new_task_key', v_new.key));

  return v_new;
end;
$$;

-- ─────────────────────────────────────────────
-- 초대 확인·수락
-- ─────────────────────────────────────────────
-- 호출자 이메일(auth.users.email)로 온 pending 초대 목록. 아직 구성원이 아니라 워크스페이스 이름을 볼 수 없어 함께 돌려준다.
-- definer 사유. 클라이언트는 auth.users를 읽을 수 없고, 초대받은 사람은 workspace_invites·workspaces 조회 정책 대상이 아니다.
-- 함수 안에서 auth.uid()의 이메일과 일치하는 초대만 돌려준다.
create function public.my_invites()
returns table (invite_id uuid, workspace_id uuid, workspace_name text, role public.ws_role, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.workspace_id, w.name, i.role, i.created_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  join auth.users u on u.id = auth.uid()
  where i.status = 'pending' and lower(i.email) = lower(u.email)
  order by i.created_at desc;
$$;

-- 초대 수락. 초대가 pending이고 초대 이메일이 호출자 이메일과 대소문자 무시로 같을 때만
-- 그 역할의 active 구성원이 되고 초대는 accepted가 된다.
-- 이미 행이 있으면 invited 상태일 때만 초대 역할의 active로 바꾼다. deactivated는 관리자가 정한 상태라
-- 바꾸지 않고 초대만 accepted로 처리한다(관리자 결정 우선). active면 초대만 accepted가 된다.
-- 남의 초대이거나 처리된 초대는 not_found로 답한다(초대 존재를 드러내지 않는다).
-- definer 사유. workspace_members에는 클라이언트 insert 권한이 없다(동의 없는 구성원 추가 방지).
create function public.accept_invite(p_invite uuid)
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

-- 이미 구성원(active·deactivated)인 이메일로는 pending 초대를 만들 수 없다(already_member).
-- invited 상태 구성원은 초대를 수락해야 active가 되므로 초대를 허용한다(accept_invite).
-- 회수·수락된 초대를 다시 pending으로 돌리는 update에도 같은 규칙을 적용한다.
-- definer 사유. 이메일로 구성원을 찾으려면 클라이언트가 읽을 수 없는 auth.users를 봐야 한다.
create function public.guard_invite_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = new.workspace_id and m.status <> 'invited' and lower(u.email) = lower(new.email)
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;
  return new;
end;
$$;

create trigger workspace_invites_guard
  before insert or update on public.workspace_invites
  for each row execute function public.guard_invite_write();

-- 구성원 행을 지우면 그 사람 이메일로 남은 같은 워크스페이스의 pending 초대를 회수한다.
-- 남은 초대로 accept_invite를 해 제거된 사람이 스스로 돌아오는 일을 막는다.
-- definer 사유. 이메일은 auth.users에 있고, 삭제하는 관리자가 초대 update 권한을 갖는다는 보장이 없다.
create function public.on_workspace_member_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspace_invites i set status = 'revoked'
  from auth.users u
  where u.id = old.user_id and i.workspace_id = old.workspace_id
    and i.status = 'pending' and lower(i.email) = lower(u.email);
  return null;
end;
$$;

create trigger workspace_members_revoke_invites
  after delete on public.workspace_members
  for each row execute function public.on_workspace_member_deleted();

-- ─────────────────────────────────────────────
-- 구성원 역할 변경
-- ─────────────────────────────────────────────
-- invoker라 workspace_members 정책과 guard_workspace_member 트리거 규칙을 그대로 받는다.
create function public.set_member_role(p_workspace uuid, p_user uuid, p_role public.ws_role)
returns public.workspace_members
language plpgsql
set search_path = ''
as $$
declare
  v_m public.workspace_members;
begin
  perform private.require_uid();
  update public.workspace_members m set role = p_role
  where m.workspace_id = p_workspace and m.user_id = p_user
  returning * into v_m;
  if not found then
    if exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user) then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return v_m;
end;
$$;

-- ─────────────────────────────────────────────
-- 실행 권한. 클라이언트 RPC는 authenticated에만, anon·public은 회수
-- ─────────────────────────────────────────────
-- invoker RPC·트리거가 authenticated로 부르는 내부 함수
revoke execute on function
  private.require_uid(),
  private.next_task_seq(uuid),
  private.spawn_next_occurrence(uuid),
  private.require_task_edit(uuid, boolean)
from public, anon;
grant execute on function
  private.require_uid(),
  private.next_task_seq(uuid),
  private.spawn_next_occurrence(uuid),
  private.require_task_edit(uuid, boolean)
to authenticated;

-- definer 함수 안에서만 쓰는 내부 함수. 클라이언트 역할은 실행할 수 없다.
revoke execute on function
  private.log_activity(uuid, uuid, text, jsonb),
  private.plain_snippet(text),
  private.notify(uuid, public.notification_type, uuid, uuid, text, text),
  private.require_file_edit(uuid),
  private.require_file_visible(uuid)
from public, anon, authenticated;

-- 트리거 함수
revoke execute on function
  public.guard_task_insert(),
  public.on_task_written(),
  public.on_subtask_written(),
  public.on_task_dep_written(),
  public.on_comment_inserted(),
  public.on_file_written(),
  public.on_project_written(),
  public.guard_invite_write(),
  public.on_workspace_member_deleted()
from public, anon, authenticated;

revoke execute on function
  public.create_project(uuid, text, text, text, public.project_access, text, public.project_status, uuid, uuid, date, date, text),
  public.create_workspace_onboarding(text, text, text, text, text, text, text[]),
  public.create_task(uuid, text, public.task_status, public.task_priority, uuid, date, date, text[], text, text, public.repeat_kind, numeric),
  public.move_task(uuid, public.task_status, numeric),
  public.complete_task(uuid),
  public.reopen_task(uuid),
  public.soft_delete_task(uuid),
  public.restore_task(uuid, timestamptz),
  public.purge_task(uuid),
  public.soft_delete_project(uuid),
  public.restore_project(uuid, timestamptz),
  public.purge_project(uuid),
  public.soft_delete_comment(uuid),
  public.restore_comment(uuid, timestamptz),
  public.purge_comment(uuid),
  public.soft_delete_file(uuid),
  public.restore_file(uuid, timestamptz),
  public.purge_file(uuid),
  public.finalize_file(uuid),
  public.fail_file(uuid),
  public.retry_file(uuid),
  public.add_comment(uuid, text, uuid[]),
  public.convert_subtask(uuid),
  public.my_invites(),
  public.accept_invite(uuid),
  public.set_member_role(uuid, uuid, public.ws_role)
from public, anon;

grant execute on function
  public.create_project(uuid, text, text, text, public.project_access, text, public.project_status, uuid, uuid, date, date, text),
  public.create_workspace_onboarding(text, text, text, text, text, text, text[]),
  public.create_task(uuid, text, public.task_status, public.task_priority, uuid, date, date, text[], text, text, public.repeat_kind, numeric),
  public.move_task(uuid, public.task_status, numeric),
  public.complete_task(uuid),
  public.reopen_task(uuid),
  public.soft_delete_task(uuid),
  public.restore_task(uuid, timestamptz),
  public.purge_task(uuid),
  public.soft_delete_project(uuid),
  public.restore_project(uuid, timestamptz),
  public.purge_project(uuid),
  public.soft_delete_comment(uuid),
  public.restore_comment(uuid, timestamptz),
  public.purge_comment(uuid),
  public.soft_delete_file(uuid),
  public.restore_file(uuid, timestamptz),
  public.purge_file(uuid),
  public.finalize_file(uuid),
  public.fail_file(uuid),
  public.retry_file(uuid),
  public.add_comment(uuid, text, uuid[]),
  public.convert_subtask(uuid),
  public.my_invites(),
  public.accept_invite(uuid),
  public.set_member_role(uuid, uuid, public.ws_role)
to authenticated;
