-- 소프트 삭제된 프로젝트의 하위 행은 편집 권한자만 보고(보관함·복원용) 쓰기는 모두 거부되는지 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ─────────────────────────────────────────────
-- 픽스처
-- 사용자 o owner, m member(워크스페이스 공개라 edit), v member(project_members view)
-- 프로젝트 P에 하위 행을 한 건씩 만든 뒤 삭제 상태로 둔다
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e801', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000e802', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000e803', 'v@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000e800', '워크스페이스', 'ws-e8', '00000000-0000-0000-0000-00000000e801');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000e800', '00000000-0000-0000-0000-00000000e801', 'owner'),
  ('10000000-0000-0000-0000-00000000e800', '00000000-0000-0000-0000-00000000e802', 'member'),
  ('10000000-0000-0000-0000-00000000e800', '00000000-0000-0000-0000-00000000e803', 'member');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000e8a0', '10000000-0000-0000-0000-00000000e800', 'PD', '삭제될 프로젝트', 'workspace');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-00000000e8a0', '00000000-0000-0000-0000-00000000e803', 'view');

insert into public.tasks (id, workspace_id, project_id, key, title, sort_order) values
  ('30000000-0000-0000-0000-00000000e8a1', '10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', 'PD-101', 't1', 1),
  ('30000000-0000-0000-0000-00000000e8a2', '10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', 'PD-102', 't2', 2);
insert into public.subtasks (task_id, title) values ('30000000-0000-0000-0000-00000000e8a1', '하위');
insert into public.task_deps (task_id, blocked_by_id) values
  ('30000000-0000-0000-0000-00000000e8a1', '30000000-0000-0000-0000-00000000e8a2');
insert into public.milestones (project_id, name, date) values ('20000000-0000-0000-0000-00000000e8a0', '마일스톤', '2026-11-01');
insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-00000000e801', '30000000-0000-0000-0000-00000000e8a1', '00000000-0000-0000-0000-00000000e802', '댓글');
insert into public.comment_reactions (comment_id, user_id, emoji) values
  ('40000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-00000000e803', '👍');
insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by) values
  ('50000000-0000-0000-0000-00000000e801', '10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0',
   'a.pdf', 'a.pdf', 'application/pdf', 10,
   '10000000-0000-0000-0000-00000000e800/20000000-0000-0000-0000-00000000e8a0/50000000-0000-0000-0000-00000000e801/a.pdf',
   'ready', '00000000-0000-0000-0000-00000000e802');
insert into storage.objects (bucket_id, name, metadata) values
  ('files', '10000000-0000-0000-0000-00000000e800/20000000-0000-0000-0000-00000000e8a0/50000000-0000-0000-0000-00000000e801/a.pdf',
   '{"size": 10}');
insert into public.events (workspace_id, project_id, title, date) values
  ('10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', '일정', '2026-11-02');
insert into public.saved_views (workspace_id, project_id, name) values
  ('10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', '보기');
insert into public.activities (workspace_id, project_id, task_id, actor_id, verb) values
  ('10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', '30000000-0000-0000-0000-00000000e8a1',
   '00000000-0000-0000-0000-00000000e801', 'created');

update public.projects set deleted_at = now() where id = '20000000-0000-0000-0000-00000000e8a0';

set local role authenticated;

-- ─────────────────────────────────────────────
-- 조회 권한만 있는 구성원 v는 하위 행을 하나도 보지 못한다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e803","role":"authenticated"}', true);
select is_empty($$select 1 from public.tasks where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '삭제된 프로젝트의 작업은 조회 권한자에게 보이지 않는다');
select is_empty($$select 1 from public.subtasks where task_id = '30000000-0000-0000-0000-00000000e8a1'$$,
  '서브태스크도 보이지 않는다');
select is_empty($$select 1 from public.task_deps where task_id = '30000000-0000-0000-0000-00000000e8a1'$$,
  '의존성도 보이지 않는다');
select is_empty($$select 1 from public.milestones where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '마일스톤도 보이지 않는다');
select is_empty($$select 1 from public.comments where task_id = '30000000-0000-0000-0000-00000000e8a1'$$,
  '댓글도 보이지 않는다');
select is_empty($$select 1 from public.comment_reactions where comment_id = '40000000-0000-0000-0000-00000000e801'$$,
  '반응도 보이지 않는다');
select is_empty($$select 1 from public.files where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '파일도 보이지 않는다');
select is_empty($$select 1 from storage.objects where name like '%/20000000-0000-0000-0000-00000000e8a0/%'$$,
  '파일 객체도 보이지 않는다');
select is_empty($$select 1 from public.events where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '일정도 보이지 않는다');
select is_empty($$select 1 from public.saved_views where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '저장된 보기도 보이지 않는다');
select is_empty($$select 1 from public.activities where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '활동도 보이지 않는다');

-- ─────────────────────────────────────────────
-- 편집 권한자 m은 보지만 쓸 수는 없다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e802","role":"authenticated"}', true);
select isnt_empty($$select 1 from public.tasks where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '편집 권한자는 삭제된 프로젝트의 작업을 본다(보관함)');
select isnt_empty($$select 1 from public.comments where task_id = '30000000-0000-0000-0000-00000000e8a1'$$,
  '편집 권한자는 댓글도 본다');
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, title, sort_order)
    values ('10000000-0000-0000-0000-00000000e800', '20000000-0000-0000-0000-00000000e8a0', '새 작업', 3)$$,
  'P0001', 'forbidden', '삭제된 프로젝트에는 작업을 직접 넣을 수 없다');
with u as (update public.tasks set title = '수정' where id = '30000000-0000-0000-0000-00000000e8a1' returning 1)
select is(count(*), 0::bigint, '삭제된 프로젝트의 작업 수정은 0행') from u;
select throws_ok(
  $$select public.move_task('30000000-0000-0000-0000-00000000e8a1', 'done')$$,
  'P0001', 'project_deleted', '삭제된 프로젝트의 작업은 이동할 수 없다');
select throws_ok(
  $$select public.create_task('20000000-0000-0000-0000-00000000e8a0', '새 작업')$$,
  'P0001', 'not_found', '삭제된 프로젝트에는 create_task를 할 수 없다');
select throws_ok(
  $$insert into public.subtasks (task_id, title) values ('30000000-0000-0000-0000-00000000e8a1', '새 하위')$$,
  '42501', null, '서브태스크를 넣을 수 없다');
select throws_ok(
  $$insert into public.comments (task_id, author_id, body)
    values ('30000000-0000-0000-0000-00000000e8a1', '00000000-0000-0000-0000-00000000e802', '새 댓글')$$,
  '42501', null, '댓글을 넣을 수 없다');
select throws_ok(
  $$select public.add_comment('30000000-0000-0000-0000-00000000e8a1', '새 댓글')$$,
  'P0001', 'forbidden', 'add_comment도 거부된다');
select throws_ok(
  $$insert into public.milestones (project_id, name, date) values ('20000000-0000-0000-0000-00000000e8a0', '새 마일스톤', '2026-12-01')$$,
  '42501', null, '마일스톤을 넣을 수 없다');

-- ─────────────────────────────────────────────
-- owner도 하위 행을 지울 수 없고, 프로젝트를 복원하면 다시 열린다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e801","role":"authenticated"}', true);
select throws_ok(
  $$select public.purge_task('30000000-0000-0000-0000-00000000e8a2')$$,
  'P0001', 'project_deleted', 'owner도 삭제된 프로젝트의 작업을 영구 삭제할 수 없다');
reset role;
update public.projects set deleted_at = null where id = '20000000-0000-0000-0000-00000000e8a0';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e803","role":"authenticated"}', true);
select isnt_empty($$select 1 from public.tasks where project_id = '20000000-0000-0000-0000-00000000e8a0'$$,
  '프로젝트를 복원하면 조회 권한자도 다시 본다');

reset role;
select * from finish();
rollback;
