-- enum, 테이블, 제약, 인덱스, updated_at 트리거, auth.users → profiles 자동 생성 트리거를 만든다.

-- ─────────────────────────────────────────────
-- enum (META §4 내부 id 그대로)
-- ─────────────────────────────────────────────
create type public.task_status as enum ('backlog', 'todo', 'progress', 'review', 'done');
create type public.task_priority as enum ('urgent', 'high', 'medium', 'low', 'none');
create type public.project_status as enum ('planning', 'active', 'risk', 'hold', 'complete');
create type public.ws_role as enum ('owner', 'admin', 'member', 'guest');
create type public.member_status as enum ('active', 'invited', 'deactivated');
-- 선언 순서가 곧 권한 크기 순서다. least()·비교 연산이 이 순서에 의존한다.
create type public.share_perm as enum ('view', 'comment', 'edit', 'full');
create type public.project_access as enum ('workspace', 'private');
create type public.repeat_kind as enum ('none', 'daily', 'weekly', 'biweekly', 'monthly');
create type public.file_type as enum ('fig', 'pdf', 'zip', 'img', 'sheet', 'doc', 'code', 'other');
create type public.file_status as enum ('pending', 'ready', 'failed');
create type public.notification_type as enum ('mention', 'assign', 'comment', 'update');
create type public.view_type as enum ('list', 'board', 'table');

-- ─────────────────────────────────────────────
-- 공용 트리거 함수
-- ─────────────────────────────────────────────
-- now()는 트랜잭션 안에서 고정되므로 clock_timestamp()를 쓴다.
-- 같은 트랜잭션에서 두 번 수정해도 updated_at이 달라져야 복원 토큰 충돌(META §6)을 판정할 수 있다.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 사용자·워크스페이스
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  color text not null default 'indigo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  color text not null default 'indigo',
  -- 온보딩 응답(용도, 규모). 화면 분기에만 쓰는 참고값이다.
  usage text,
  team_size text check (team_size is null or team_size in ('solo', '2-10', '11-50', '51-200', '200+')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_created_by_idx on public.workspaces (created_by);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  icon text not null default 'folder',
  color text not null default 'indigo',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 하위 테이블이 같은 워크스페이스의 팀만 가리키게 하는 복합 FK 대상
  unique (id, workspace_id)
);
create index teams_workspace_id_idx on public.teams (workspace_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.ws_role not null default 'member',
  status public.member_status not null default 'active',
  title text,
  color text,
  team_id uuid,
  tz text not null default 'Asia/Seoul',
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (team_id, workspace_id) references public.teams (id, workspace_id) on delete set null (team_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_team_id_idx on public.workspace_members (team_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.ws_role not null default 'member' check (role <> 'owner'),
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 대기 중 초대는 워크스페이스·이메일당 하나
create unique index workspace_invites_pending_uidx
  on public.workspace_invites (workspace_id, lower(email)) where status = 'pending';
create index workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);
create index workspace_invites_invited_by_idx on public.workspace_invites (invited_by);

-- ─────────────────────────────────────────────
-- 프로젝트
-- ─────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[A-Z][A-Z0-9]{0,9}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  icon text not null default 'folder' check (icon in (
    'globe', 'smartphone', 'megaphone', 'rocket', 'component', 'building-2', 'layout-grid', 'palette',
    'code', 'briefcase', 'target', 'layers', 'zap', 'heart', 'folder', 'sparkles')),
  color text not null default 'indigo' check (color in (
    'indigo', 'blue', 'violet', 'teal', 'rose', 'amber', 'green', 'slate')),
  status public.project_status not null default 'planning',
  team_id uuid,
  lead_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  description text,
  access public.project_access not null default 'workspace',
  -- 작업 키 번호. 새 작업은 201부터(next_task_seq가 +1 후 반환)
  seq int not null default 200,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key),
  -- 하위 테이블 복합 FK 대상
  unique (id, workspace_id),
  check (start_date is null or due_date is null or start_date <= due_date),
  foreign key (team_id, workspace_id) references public.teams (id, workspace_id) on delete set null (team_id)
);
create index projects_team_id_idx on public.projects (team_id);
create index projects_lead_id_idx on public.projects (lead_id);
create index projects_created_by_idx on public.projects (created_by);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  perm public.share_perm not null default 'edit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_id_idx on public.project_members (user_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_id_idx on public.milestones (project_id);

-- ─────────────────────────────────────────────
-- 작업
-- ─────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  -- null로 넣으면 assign_task_key 트리거가 {KEY}-{seq}로 채운다
  key text not null,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  labels text[] not null default '{}' check (labels <@ array[
    'design', 'frontend', 'backend', 'research', 'content', 'bug', 'qa', 'growth']::text[]),
  -- 앱 서버가 sanitize-html로 정제한 뒤 저장한다(DB는 정제하지 않는다)
  description_html text,
  estimate text check (estimate is null or estimate in ('30m', '1h', '2h', '4h', '1d', '2d', '3d', '5d', '8d')),
  sort_order numeric not null,
  recur public.repeat_kind not null default 'none',
  -- 이 작업을 완료해서 생긴 다음 회차의 원본. 한 작업에서 다음 회차는 하나뿐이다.
  -- 같은 프로젝트 작업만 가리킨다(아래 복합 FK). 클라이언트는 직접 넣거나 바꿀 수 없다(가드 트리거).
  recur_source_id uuid unique,
  completed_at timestamptz,
  prev_status public.task_status,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key),
  -- files 복합 FK 대상(첨부 작업이 같은 프로젝트인지 강제)
  unique (id, project_id),
  check (start_date is null or due_date is null or start_date <= due_date),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  foreign key (recur_source_id, project_id) references public.tasks (id, project_id) on delete set null (recur_source_id)
);
create index tasks_workspace_id_idx on public.tasks (workspace_id);
create index tasks_project_status_idx on public.tasks (project_id, status, sort_order);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_created_by_idx on public.tasks (created_by);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  done boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  note text,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subtasks_task_id_idx on public.subtasks (task_id, sort_order);
create index subtasks_assignee_id_idx on public.subtasks (assignee_id);

create table public.task_deps (
  task_id uuid not null references public.tasks (id) on delete cascade,
  blocked_by_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, blocked_by_id),
  check (task_id <> blocked_by_id)
);
create index task_deps_blocked_by_id_idx on public.task_deps (blocked_by_id);

-- ─────────────────────────────────────────────
-- 파일·댓글·활동·알림
-- ─────────────────────────────────────────────
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  -- 사용자에게 보이는 원본 파일명(한글 가능). 다운로드 시 앱이 서명 URL의 download 옵션으로 붙인다.
  -- 앱은 슬래시·역슬래시·제어문자를 '_'로 바꾸고 앞뒤 공백을 지워 넣는다.
  name text not null check (
    char_length(name) between 1 and 255
    and name !~ '[/\\[:cntrl:]]'
    and name not in ('.', '..')
    and name = btrim(name)),
  -- Storage 객체 이름. 로컬 Storage가 한글 키를 거부하므로 name과 따로 ASCII로 둔다.
  -- 앱이 정한다(예 확장자만 남긴 'file.pdf').
  object_name text not null check (object_name ~ '^[A-Za-z0-9._-]{1,128}$' and object_name not in ('.', '..')),
  type public.file_type not null default 'other',
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  -- {workspace_id}/{project_id}/{file_id}/{object_name}. 행의 값과 어긋난 경로는 check로 거부한다.
  storage_path text not null unique,
  status public.file_status not null default 'pending',
  uploaded_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path = workspace_id::text || '/' || project_id::text || '/' || id::text || '/' || object_name),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  -- 작업을 영구 삭제하면 파일은 프로젝트에 남긴다(task_id만 비움)
  foreign key (task_id, project_id) references public.tasks (id, project_id) on delete set null (task_id)
);
create index files_workspace_id_idx on public.files (workspace_id);
create index files_project_id_idx on public.files (project_id);
create index files_task_id_idx on public.files (task_id);
create index files_uploaded_by_idx on public.files (uploaded_by);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 소프트 삭제한 사람. 관리자가 지운 댓글을 작성자가 되살리지 못하게 restore_comment가 본다.
  deleted_by uuid references public.profiles (id) on delete set null
);
create index comments_task_id_idx on public.comments (task_id, created_at);
create index comments_author_id_idx on public.comments (author_id);
create index comments_deleted_by_idx on public.comments (deleted_by);

create table public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- ❤️는 U+2764 U+FE0F 두 코드포인트다. 앱도 같은 문자열을 보내야 한다.
  emoji text not null check (emoji in ('👍', '🎉', '❤️', '👀', '🚀', '✅')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
create index comment_reactions_user_id_idx on public.comment_reactions (user_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  verb text not null check (verb in (
    'moved', 'completed', 'commented on', 'changed priority of', 'added a file to', 'created', 'assigned',
    'created project', 'changed due date of', 'changed start date of', 'updated labels on', 'renamed',
    'set repeat on', 'estimated', 'updated dependencies of', 'archived', 'restored', 'completed subtask on',
    'reopened subtask on', 'added subtask to', 'removed a file from', 'assigned a subtask on',
    'set a subtask due date on', 'converted a subtask of', 'changed status of project')),
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  -- 활동의 작업은 같은 프로젝트 작업이어야 한다
  foreign key (task_id, project_id) references public.tasks (id, project_id) on delete set null (task_id)
);
create index activities_workspace_created_idx on public.activities (workspace_id, created_at desc);
create index activities_project_id_idx on public.activities (project_id, created_at desc);
create index activities_task_id_idx on public.activities (task_id);
create index activities_actor_id_idx on public.activities (actor_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- 수신자
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  task_id uuid,
  project_id uuid,
  -- 서버가 고정 템플릿으로 만든 문구와 평문 발췌. 클라이언트는 알림을 만들 수 없다.
  text text not null default '',
  snippet text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- 복합 FK는 한 컬럼이라도 null이면 검사하지 않으므로 작업이 있으면 프로젝트도 있어야 한다
  check (task_id is null or project_id is not null),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  foreign key (task_id, project_id) references public.tasks (id, project_id) on delete cascade
);
create index notifications_user_ws_idx on public.notifications (user_id, workspace_id, created_at desc);
create index notifications_workspace_id_idx on public.notifications (workspace_id);
create index notifications_actor_id_idx on public.notifications (actor_id);
create index notifications_task_id_idx on public.notifications (task_id);
create index notifications_project_id_idx on public.notifications (project_id);

-- ─────────────────────────────────────────────
-- 일정·뷰
-- ─────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  date date not null,
  time time,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index events_workspace_date_idx on public.events (workspace_id, date);
create index events_project_id_idx on public.events (project_id);
create index events_created_by_idx on public.events (created_by);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  type public.view_type not null default 'list',
  filters jsonb not null default '[]' check (jsonb_typeof(filters) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index saved_views_workspace_id_idx on public.saved_views (workspace_id);
create index saved_views_project_id_idx on public.saved_views (project_id);
create index saved_views_created_by_idx on public.saved_views (created_by);

-- ─────────────────────────────────────────────
-- 사용자 귀속 설정
-- ─────────────────────────────────────────────
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(project_id, task_id) = 1),
  unique nulls not distinct (user_id, workspace_id, project_id, task_id)
);
create index favorites_workspace_id_idx on public.favorites (workspace_id);
create index favorites_project_id_idx on public.favorites (project_id);
create index favorites_task_id_idx on public.favorites (task_id);

create table public.user_view_states (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- tasks, mytasks, cal, tl, p:{프로젝트 uuid}, sv:{저장 뷰 uuid}
  view_key text not null check (view_key ~ '^(tasks|mytasks|cal|tl|(p|sv):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  state jsonb not null default '{}' check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id, view_key)
);
create index user_view_states_workspace_id_idx on public.user_view_states (workspace_id);

create table public.user_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  default_tab text,
  show_done_board boolean not null default true,
  notif_prefs jsonb not null default '{}' check (jsonb_typeof(notif_prefs) = 'object'),
  time_fmt text not null default '24h' check (time_fmt in ('12h', '24h')),
  confirm_del boolean not null default true,
  proj_order uuid[] not null default '{}',
  recent_searches text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
create index user_prefs_workspace_id_idx on public.user_prefs (workspace_id);

-- ─────────────────────────────────────────────
-- updated_at 트리거
-- ─────────────────────────────────────────────
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger workspace_members_updated_at before update on public.workspace_members
  for each row execute function public.set_updated_at();
create trigger workspace_invites_updated_at before update on public.workspace_invites
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger project_members_updated_at before update on public.project_members
  for each row execute function public.set_updated_at();
create trigger milestones_updated_at before update on public.milestones
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger subtasks_updated_at before update on public.subtasks
  for each row execute function public.set_updated_at();
create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger saved_views_updated_at before update on public.saved_views
  for each row execute function public.set_updated_at();
create trigger user_view_states_updated_at before update on public.user_view_states
  for each row execute function public.set_updated_at();
create trigger user_prefs_updated_at before update on public.user_prefs
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- auth.users 가입 시 profiles 자동 생성
-- ─────────────────────────────────────────────
-- definer 사유. auth 스키마 트리거는 가입 요청 역할(supabase_auth_admin)로 돌고
-- 그 역할에는 public.profiles 쓰기 권한이 없다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
