-- 게스트가 볼 수 있는 구성원 범위를 좁히고, create_project가 리드의 워크스페이스 소속을 확인하게 한다.
--
-- 게스트 구성원 가시성(spec 결정 "게스트는 초대된 프로젝트만 보기·댓글")
-- 바뀌기 전에는 게스트도 같은 워크스페이스의 모든 profiles(name·email)와 workspace_members(역할·tz·최근 접속)를 읽었다.
-- 이제 게스트는 자기 자신과, 자기가 project_members로 들어간 프로젝트를 볼 수 있는 사람만 본다.
-- "볼 수 있는 사람"은 project_perm_for 기준이다. owner/admin, 공개 프로젝트의 일반 구성원, 같은 프로젝트의 다른 게스트가 포함된다.
-- 이렇게 해야 게스트가 보는 댓글 작성자·활동 주체·파일 업로더 이름이 비지 않는다.
-- 비공개 프로젝트에서는 project_members 행이 있는 사람만 남는다.
-- 게스트가 아닌 구성원의 판정은 바뀌지 않는다.

-- 현재 사용자가 워크스페이스 ws에서 project_members로 들어간 프로젝트 중 p_user도 볼 수 있는 것이 있는지
-- definer 사유. project_members·projects RLS와 무관하게 판정해야 하고, 다른 사람 권한은 private 함수로만 본다.
-- 돌려주는 값은 true/false뿐이라 p_user의 권한 등급은 새지 않는다.
create function public.guest_shares_project(ws uuid, p_user uuid)
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

-- 현재 사용자와 지정한 사용자가 같은 워크스페이스에 속하는지(profiles 조회용)
-- 보는 쪽은 active, 보이는 쪽은 상태 무관(초대됨·비활성 구성원도 목록에 보여야 한다)
-- 보는 쪽이 그 워크스페이스의 게스트면 guest_shares_project가 참인 사람만 본다. 자기 자신은 profiles_select가 따로 연다.
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
      and (me.role <> 'guest' or public.guest_shares_project(me.workspace_id, p_user))
  );
$$;

-- workspace_members 조회. 자기 행(초대됨·비활성 상태여도), 같은 워크스페이스 구성원.
-- 게스트는 guest_shares_project가 참인 사람의 행만 본다.
alter policy workspace_members_select on public.workspace_members
  using (
    user_id = (select auth.uid())
    or (public.is_ws_member(workspace_id)
        and (public.ws_role(workspace_id) <> 'guest' or public.guest_shares_project(workspace_id, user_id)))
  );

-- ─────────────────────────────────────────────
-- 프로젝트 생성(rpc 마이그레이션 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. p_lead가 그 워크스페이스의 active·invited 구성원이 아니면 invalid_assignee로 거부한다.
-- 기준과 오류 코드는 guard_task_assignee와 같다. lead_id는 profiles만 참조해 DB가 소속을 보지 않았다.
-- 나머지 동작은 rpc 마이그레이션과 같다.
-- definer 사유. projects에는 insert 정책이 없고(생성 경로를 이 함수로 고정),
-- 생성자를 project_members full로 넣으려면 아직 없는 관리 권한이 필요하다.
-- 함수 안에서 auth.uid()와 워크스페이스 역할(guest가 아닌 active 구성원)을 직접 확인한다.
create or replace function public.create_project(
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
  if p_lead is not null and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = p_lead and m.status in ('active', 'invited')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_assignee';
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

revoke execute on function
  public.guest_shares_project(uuid, uuid),
  public.shares_workspace(uuid),
  public.create_project(uuid, text, text, text, public.project_access, text, public.project_status, uuid, uuid, date, date, text)
from public, anon;
grant execute on function
  public.guest_shares_project(uuid, uuid),
  public.shares_workspace(uuid),
  public.create_project(uuid, text, text, text, public.project_access, text, public.project_status, uuid, uuid, date, date, text)
to authenticated;
