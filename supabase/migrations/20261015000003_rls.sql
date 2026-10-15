-- 모든 public 테이블에 RLS를 켜고 정책, 권한 상승·값 위조 방지 트리거, 컬럼 권한을 설정한다.
-- 정책은 auth_helpers의 헬퍼만 호출한다. 정책 안에서 다른 테이블을 직접 조인하지 않는다.
-- 정책은 전부 authenticated 대상이다. anon에는 어떤 테이블도 열지 않는다(맨 아래 revoke).
-- 프로젝트 하위 테이블은 can_*_project_rows 헬퍼로 삭제된 프로젝트의 하위 쓰기를 막는다.
-- activities·notifications에는 insert 정책이 없다. 생성은 rpc 마이그레이션의 definer 트리거·함수만 한다.

-- 가드 트리거는 security invoker이고 current_user = 'authenticated'일 때만 규칙을 적용한다.
-- 클라이언트 요청은 항상 authenticated로 실행된다. definer 함수(온보딩, 프로젝트 생성, seq 증가 등)는
-- 함수 소유자 권한으로 돌아 이 검사를 건너뛰며, 대신 함수 안에서 auth.uid()와 권한을 직접 확인한다.
-- 마이그레이션·시드(postgres)도 같은 이유로 건너뛴다.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.teams enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_deps enable row level security;
alter table public.files enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;
alter table public.saved_views enable row level security;
alter table public.favorites enable row level security;
alter table public.user_view_states enable row level security;
alter table public.user_prefs enable row level security;

-- ─────────────────────────────────────────────
-- profiles. 본인과 같은 워크스페이스 사람 조회, 본인만 name·color 수정
-- 생성은 auth.users 트리거, 삭제는 auth.users cascade
-- ─────────────────────────────────────────────
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (name, color) on public.profiles to authenticated;

-- ─────────────────────────────────────────────
-- workspaces. 구성원 조회, owner/admin 수정. 생성은 RPC, 삭제 경로는 아직 없음
-- ─────────────────────────────────────────────
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_ws_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.is_ws_admin(id))
  with check (public.is_ws_admin(id));
revoke update on public.workspaces from authenticated;
grant update (name, slug, color) on public.workspaces to authenticated;

-- ─────────────────────────────────────────────
-- teams. 구성원 조회, owner/admin 쓰기
-- ─────────────────────────────────────────────
create policy teams_select on public.teams for select to authenticated
  using (public.is_ws_member(workspace_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.is_ws_admin(workspace_id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_ws_admin(workspace_id))
  with check (public.is_ws_admin(workspace_id));
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_ws_admin(workspace_id));

-- ─────────────────────────────────────────────
-- workspace_members
-- 조회. 같은 워크스페이스 구성원, 그리고 자기 행(초대됨·비활성 상태여도)
-- 추가. 클라이언트 insert는 없다. 동의 없이 남을 구성원으로 넣고 그 이메일을 읽는 일을 막는다.
--       구성원은 create_workspace_onboarding(owner 본인)과 accept_invite(초대받은 본인)로만 생긴다.
-- 삭제. owner/admin. 수정. owner/admin 또는 본인(본인은 title·tz·last_active_at만, 트리거로 강제)
-- ─────────────────────────────────────────────
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_ws_member(workspace_id));
revoke insert on public.workspace_members from authenticated;
create policy workspace_members_update on public.workspace_members for update to authenticated
  using (user_id = (select auth.uid()) or public.is_ws_admin(workspace_id))
  with check (user_id = (select auth.uid()) or public.is_ws_admin(workspace_id));
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (public.is_ws_admin(workspace_id));

-- 역할 변경 규칙
-- 1. 자기 자신의 role·status는 바꿀 수 없다.
-- 2. owner 부여·박탈과 owner 행 수정·삭제는 owner만 한다(admin은 owner를 건드릴 수 없다).
-- 3. 마지막 active owner는 없앨 수 없다.
-- 4. owner/admin이 아닌 본인은 title·tz·last_active_at만 바꾼다.
create function public.guard_workspace_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid := coalesce(new.workspace_id, old.workspace_id);
  v_actor public.ws_role;
  v_removes_owner boolean := false;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  v_actor := public.ws_role(v_ws);

  if tg_op = 'INSERT' then
    if not public.is_ws_admin(v_ws) then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
    if new.role = 'owner' and v_actor <> 'owner' then
      raise exception using errcode = 'P0001', message = 'owner_only';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;

    if old.user_id = v_uid then
      if new.role <> old.role or new.status <> old.status then
        raise exception using errcode = 'P0001', message = 'self_role_change';
      end if;
      if not public.is_ws_admin(v_ws)
         and (new.color is distinct from old.color or new.team_id is distinct from old.team_id) then
        raise exception using errcode = 'P0001', message = 'forbidden';
      end if;
      return new;
    end if;

    if not public.is_ws_admin(v_ws) then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
    if (old.role = 'owner' or new.role = 'owner') and v_actor <> 'owner' then
      raise exception using errcode = 'P0001', message = 'owner_only';
    end if;
    v_removes_owner := old.role = 'owner' and old.status = 'active'
                       and not (new.role = 'owner' and new.status = 'active');
  end if;

  if tg_op = 'DELETE' then
    if not public.is_ws_admin(v_ws) then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
    if old.role = 'owner' and v_actor <> 'owner' then
      raise exception using errcode = 'P0001', message = 'owner_only';
    end if;
    v_removes_owner := old.role = 'owner' and old.status = 'active';
  end if;

  if v_removes_owner and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = v_ws and m.role = 'owner' and m.status = 'active' and m.user_id <> old.user_id
  ) then
    raise exception using errcode = 'P0001', message = 'last_owner';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger workspace_members_guard
  before insert or update or delete on public.workspace_members
  for each row execute function public.guard_workspace_member();

-- ─────────────────────────────────────────────
-- workspace_invites. owner/admin만 읽기·쓰기
-- 초대받은 본인은 my_invites()로 자기 이메일의 pending 초대를 보고 accept_invite()로 수락한다(rpc 마이그레이션).
-- ─────────────────────────────────────────────
create policy workspace_invites_select on public.workspace_invites for select to authenticated
  using (public.is_ws_admin(workspace_id));
create policy workspace_invites_insert on public.workspace_invites for insert to authenticated
  with check (public.is_ws_admin(workspace_id) and invited_by = (select auth.uid()));
create policy workspace_invites_update on public.workspace_invites for update to authenticated
  using (public.is_ws_admin(workspace_id))
  with check (public.is_ws_admin(workspace_id));
create policy workspace_invites_delete on public.workspace_invites for delete to authenticated
  using (public.is_ws_admin(workspace_id));

-- ─────────────────────────────────────────────
-- projects
-- 조회. can_view_project. 소프트 삭제된 프로젝트는 can_edit_project일 때만(보관함·복원)
-- 수정. can_edit_project는 이름·아이콘·색·상태·팀·기간·설명을 바꾼다.
--       access·lead_id·archived_at은 can_manage_project만(트리거로 강제).
--       key·seq·workspace_id·created_by는 클라이언트가 바꾸지 못한다(트리거로 강제).
--       deleted_at은 클라이언트가 바꾸지 못한다. 소프트 삭제·복원은 soft_delete_project·restore_project(토큰 확인)만.
--       archived_at은 보관 기능이라 can_manage_project가 직접 바꿀 수 있다(복원 토큰 대상이 아니다).
-- 생성. RPC create_project만(insert 정책 없음).
-- 영구 삭제. purge_project(definer)만. 직접 delete는 휴지통과 Storage 정리를 건너뛰므로 권한을 거둔다.
-- ─────────────────────────────────────────────
create policy projects_select on public.projects for select to authenticated
  using (public.can_view_project(id) and (deleted_at is null or public.can_edit_project(id)));
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_project(id))
  with check (public.can_edit_project(id));
revoke delete on public.projects from authenticated;

create function public.guard_project_update()
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
  return new;
end;
$$;

create trigger projects_guard
  before update on public.projects
  for each row execute function public.guard_project_update();

-- ─────────────────────────────────────────────
-- project_members. 조회 can_view_project, 쓰기 can_manage_project, 자기 권한 상승 불가
-- ─────────────────────────────────────────────
create policy project_members_select on public.project_members for select to authenticated
  using (public.can_view_project(project_id));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (public.can_manage_project(project_id));
create policy project_members_update on public.project_members for update to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
create policy project_members_delete on public.project_members for delete to authenticated
  using (public.can_manage_project(project_id));

-- 자기 자신을 추가하거나 자기 perm을 올리는 것은 owner/admin이 아니면 거부한다.
create function public.guard_project_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ws uuid;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.user_id <> old.user_id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if new.user_id = auth.uid() then
    select pr.workspace_id into v_ws from public.projects pr where pr.id = new.project_id;
    if not public.is_ws_admin(v_ws) and (tg_op = 'INSERT' or new.perm > old.perm) then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
  end if;
  return new;
end;
$$;

create trigger project_members_guard
  before insert or update on public.project_members
  for each row execute function public.guard_project_member();

-- ─────────────────────────────────────────────
-- milestones
-- ─────────────────────────────────────────────
create policy milestones_select on public.milestones for select to authenticated
  using (public.can_view_project_rows(project_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (public.can_edit_project_rows(project_id));
create policy milestones_update on public.milestones for update to authenticated
  using (public.can_edit_project_rows(project_id))
  with check (public.can_edit_project_rows(project_id));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.can_edit_project_rows(project_id));

-- ─────────────────────────────────────────────
-- tasks
-- 조회. can_view_project_rows, 소프트 삭제 행은 can_edit_project일 때만
-- 생성·수정. can_edit_project_rows. 영구 삭제. purge_task(definer)만(직접 delete 권한 없음)
-- deleted_at은 soft_delete_task·restore_task만 바꾼다. archived_at은 보관 기능이라 직접 바꿀 수 있다.
-- 생성 시 key·created_by·recur_source_id·completed_at 등은 서버 값으로 덮는다(rpc 마이그레이션의 guard_task_insert).
-- ─────────────────────────────────────────────
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_view_project_rows(project_id) and (deleted_at is null or public.can_edit_project(project_id)));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_edit_project_rows(project_id) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_edit_project_rows(project_id))
  with check (public.can_edit_project_rows(project_id));
revoke delete on public.tasks from authenticated;

-- 키·소속·회차 원본·작성자·삭제 상태(deleted_at)는 클라이언트가 바꾸지 못한다. 다른 프로젝트로 옮기면 키가 어긋나므로 막는다.
-- completed_at·prev_status는 클라이언트 값을 무시하고 상태 전이로만 정한다(모든 역할 공통).
-- 그래서 update tasks set status = 'done'을 직접 해도 완료 시각이 남는다.
create function public.guard_task_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.key is distinct from old.key
       or new.workspace_id is distinct from old.workspace_id
       or new.project_id is distinct from old.project_id
       or new.recur_source_id is distinct from old.recur_source_id
       or new.created_by is distinct from old.created_by
       or new.deleted_at is distinct from old.deleted_at then
      raise exception using errcode = 'P0001', message = 'forbidden';
    end if;
    new.completed_at := old.completed_at;
    new.prev_status := old.prev_status;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at := clock_timestamp();
      new.prev_status := old.status;
    elsif old.status = 'done' then
      new.completed_at := null;
      new.prev_status := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_guard
  before update on public.tasks
  for each row execute function public.guard_task_update();

-- ─────────────────────────────────────────────
-- subtasks, task_deps
-- ─────────────────────────────────────────────
create policy subtasks_select on public.subtasks for select to authenticated
  using (public.can_view_project_rows(public.task_project_id(task_id)));
create policy subtasks_insert on public.subtasks for insert to authenticated
  with check (public.can_edit_project_rows(public.task_project_id(task_id)));
create policy subtasks_update on public.subtasks for update to authenticated
  using (public.can_edit_project_rows(public.task_project_id(task_id)))
  with check (public.can_edit_project_rows(public.task_project_id(task_id)));
create policy subtasks_delete on public.subtasks for delete to authenticated
  using (public.can_edit_project_rows(public.task_project_id(task_id)));

create policy task_deps_select on public.task_deps for select to authenticated
  using (public.can_view_project_rows(public.task_project_id(task_id)));
create policy task_deps_insert on public.task_deps for insert to authenticated
  with check (public.can_edit_project_rows(public.task_project_id(task_id))
              and public.can_view_project_rows(public.task_project_id(blocked_by_id)));
create policy task_deps_delete on public.task_deps for delete to authenticated
  using (public.can_edit_project_rows(public.task_project_id(task_id)));

-- ─────────────────────────────────────────────
-- files
-- 조회. can_view_project_rows(소프트 삭제 행은 can_edit). 생성·수정. can_edit_project_rows
-- 영구 삭제. purge_file(definer)만(직접 delete 권한 없음)
-- 생성 시 status는 pending, uploaded_by는 본인으로 강제한다. 클라이언트가 바꿀 수 있는 컬럼은 task_id뿐이다.
-- status는 finalize_file·fail_file·retry_file, deleted_at은 soft_delete_file·restore_file(definer)만 바꾼다.
-- ─────────────────────────────────────────────
create policy files_select on public.files for select to authenticated
  using (public.can_view_project_rows(project_id) and (deleted_at is null or public.can_edit_project(project_id)));
create policy files_insert on public.files for insert to authenticated
  with check (public.can_edit_project_rows(project_id) and uploaded_by = (select auth.uid()));
create policy files_update on public.files for update to authenticated
  using (public.can_edit_project_rows(project_id))
  with check (public.can_edit_project_rows(project_id));
revoke update, delete on public.files from authenticated;
grant update (task_id) on public.files to authenticated;

create function public.guard_file_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.status := 'pending';
    new.uploaded_by := auth.uid();
    new.deleted_at := null;
  end if;
  return new;
end;
$$;

create trigger files_guard_insert
  before insert on public.files
  for each row execute function public.guard_file_insert();

-- ─────────────────────────────────────────────
-- comments
-- 조회. can_view_project_rows. 소프트 삭제 행은 작성자 본인(실행 취소용)과 can_edit_project만
-- 생성. can_comment_project_rows + 작성자 본인(author_id·created_at은 서버 값으로 덮는다)
-- 수정. body만(컬럼 권한). 댓글 권한이 남아 있는 작성자 본인만. 관리자도 남의 글은 고칠 수 없다.
-- 소프트 삭제·복원은 RPC(definer)만 한다(관리자 삭제 포함). 영구 삭제는 purge_comment만(직접 delete 권한 없음).
-- 멘션 알림이 필요한 작성은 add_comment RPC를 쓴다.
-- ─────────────────────────────────────────────
create policy comments_select on public.comments for select to authenticated
  using (
    public.can_view_project_rows(public.task_project_id(task_id))
    and (deleted_at is null
         or author_id = (select auth.uid())
         or public.can_edit_project(public.task_project_id(task_id)))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (public.can_comment_project_rows(public.task_project_id(task_id)) and author_id = (select auth.uid()));
create policy comments_update on public.comments for update to authenticated
  using (public.can_comment_project_rows(public.task_project_id(task_id)) and author_id = (select auth.uid()))
  with check (public.can_comment_project_rows(public.task_project_id(task_id)) and author_id = (select auth.uid()));
revoke update, delete on public.comments from authenticated;
grant update (body) on public.comments to authenticated;

create function public.guard_comment_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.author_id := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    new.deleted_at := null;
    new.deleted_by := null;
  end if;
  return new;
end;
$$;

create trigger comments_guard_insert
  before insert on public.comments
  for each row execute function public.guard_comment_insert();

-- ─────────────────────────────────────────────
-- comment_reactions. 생성 can_comment_project_rows + 본인(user_id는 서버 값), 삭제 본인 또는 can_manage. 수정 없음
-- ─────────────────────────────────────────────
create policy comment_reactions_select on public.comment_reactions for select to authenticated
  using (public.can_view_project_rows(public.comment_project_id(comment_id)));
create policy comment_reactions_insert on public.comment_reactions for insert to authenticated
  with check (public.can_comment_project_rows(public.comment_project_id(comment_id)) and user_id = (select auth.uid()));
create policy comment_reactions_delete on public.comment_reactions for delete to authenticated
  using (
    public.can_comment_project_rows(public.comment_project_id(comment_id))
    and (user_id = (select auth.uid()) or public.can_manage_project(public.comment_project_id(comment_id)))
  );

create function public.guard_reaction_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.user_id := auth.uid();
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger comment_reactions_guard_insert
  before insert on public.comment_reactions
  for each row execute function public.guard_reaction_insert();

-- ─────────────────────────────────────────────
-- activities. 조회만. 생성은 rpc 마이그레이션의 definer 트리거, 수정·삭제 불가
-- ─────────────────────────────────────────────
create policy activities_select on public.activities for select to authenticated
  using (public.can_view_project_rows(project_id));

-- ─────────────────────────────────────────────
-- notifications. 조회·읽음 처리·삭제는 수신자 본인만. 생성은 서버(definer 트리거·add_comment)만
-- ─────────────────────────────────────────────
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ─────────────────────────────────────────────
-- events, saved_views
-- ─────────────────────────────────────────────
create policy events_select on public.events for select to authenticated
  using (public.can_view_project_rows(project_id));
create policy events_insert on public.events for insert to authenticated
  with check (public.can_edit_project_rows(project_id) and created_by = (select auth.uid()));
create policy events_update on public.events for update to authenticated
  using (public.can_edit_project_rows(project_id))
  with check (public.can_edit_project_rows(project_id));
create policy events_delete on public.events for delete to authenticated
  using (public.can_edit_project_rows(project_id));

create policy saved_views_select on public.saved_views for select to authenticated
  using (public.can_view_project_rows(project_id));
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (public.can_edit_project_rows(project_id) and created_by = (select auth.uid()));
create policy saved_views_update on public.saved_views for update to authenticated
  using (public.can_edit_project_rows(project_id))
  with check (public.can_edit_project_rows(project_id));
create policy saved_views_delete on public.saved_views for delete to authenticated
  using (public.can_edit_project_rows(project_id));

-- 작성자(created_by)는 insert 때 본인으로 덮고 이후 바꿀 수 없다(events·saved_views 공통)
create function public.guard_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.created_by is distinct from old.created_by then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger events_guard_created_by
  before insert or update on public.events
  for each row execute function public.guard_created_by();
create trigger saved_views_guard_created_by
  before insert or update on public.saved_views
  for each row execute function public.guard_created_by();

-- ─────────────────────────────────────────────
-- 사용자 귀속 설정. 본인만, 쓰기는 소속 워크스페이스에만
-- ─────────────────────────────────────────────
create policy favorites_owner on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_ws_member(workspace_id));
create policy user_view_states_owner on public.user_view_states for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_ws_member(workspace_id));
create policy user_prefs_owner on public.user_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_ws_member(workspace_id));

-- ─────────────────────────────────────────────
-- 권한 정리
-- ─────────────────────────────────────────────
-- 트리거 함수는 직접 호출할 일이 없다.
revoke execute on function
  public.guard_workspace_member(),
  public.guard_project_update(),
  public.guard_project_member(),
  public.guard_task_update(),
  public.guard_file_insert(),
  public.guard_comment_insert(),
  public.guard_reaction_insert(),
  public.guard_created_by()
from public, anon, authenticated;

-- anon은 정책이 없어 0행이지만, 권한 자체를 거둬 권한 오류(42501)로 확실히 막는다.
-- 이후 새 테이블에 anon 권한이 자동으로 붙지 않도록 storage 마이그레이션에서 기본 권한도 거둔다.
revoke all on all tables in schema public from anon;
