-- 비공개 프로젝트 비구성원 차단(거부 사례 2)과 게스트 상한(거부 사례 3)을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, m member(비공개 프로젝트 비구성원), g guest(공개 프로젝트 pPub에만 edit 행 → comment로 깎임)
-- pPub 공개, pPriv 비공개(owner만 구성원), pOther 공개(게스트 비구성원)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'member@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'guest@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000000c0', '워크스페이스', 'ws-c', '00000000-0000-0000-0000-0000000000c1');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1', 'owner'),
  ('10000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2', 'member'),
  ('10000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c3', 'guest');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c0', 'PUB', '공개', 'workspace'),
  ('20000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c0', 'PRV', '비공개', 'private'),
  ('20000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000c0', 'OTH', '다른 공개', 'workspace');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'full'),
  ('20000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', 'edit');

insert into public.tasks (id, workspace_id, project_id, key, title, sort_order) values
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c1', 'PUB-100', '공개 작업', 1000),
  ('30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c2', 'PRV-100', '비공개 작업', 1000),
  ('30000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c3', 'OTH-100', '다른 작업', 1000);

insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', '비공개 댓글');

insert into public.activities (workspace_id, project_id, task_id, actor_id, verb) values
  ('10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000c1', 'created');

insert into public.files (id, workspace_id, project_id, name, object_name, type, mime, size_bytes, storage_path, status, uploaded_by) values
  ('50000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c2',
   'p.pdf', 'p.pdf', 'pdf', 'application/pdf', 10,
   '10000000-0000-0000-0000-0000000000c0/20000000-0000-0000-0000-0000000000c2/50000000-0000-0000-0000-0000000000c2/p.pdf',
   'ready', '00000000-0000-0000-0000-0000000000c1');

-- ─────────────────────────────────────────────
-- 구성원(비공개 프로젝트 비구성원)
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

select is_empty($$select 1 from public.projects where id = '20000000-0000-0000-0000-0000000000c2'$$,
  'Member는 비공개 프로젝트를 볼 수 없다');
select is_empty($$select 1 from public.tasks where project_id = '20000000-0000-0000-0000-0000000000c2'$$,
  'Member는 비공개 프로젝트 작업을 볼 수 없다');
select is_empty($$select 1 from public.comments where id = '40000000-0000-0000-0000-0000000000c2'$$,
  'Member는 비공개 프로젝트 댓글을 볼 수 없다');
select is_empty($$select 1 from public.activities where project_id = '20000000-0000-0000-0000-0000000000c2'$$,
  'Member는 비공개 프로젝트 활동을 볼 수 없다');
select is_empty($$select 1 from public.files where project_id = '20000000-0000-0000-0000-0000000000c2'$$,
  'Member는 비공개 프로젝트 파일을 볼 수 없다');
select isnt_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-0000000000c1'$$,
  'Member는 공개 프로젝트 작업을 본다');
select ok(public.can_edit_project('20000000-0000-0000-0000-0000000000c1'),
  'Member는 행이 없는 공개 프로젝트에서 편집 권한을 갖는다');

-- ─────────────────────────────────────────────
-- 게스트
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);

select isnt_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-0000000000c1'$$,
  'Guest는 구성원 프로젝트 작업을 본다');
select is(public.project_perm('20000000-0000-0000-0000-0000000000c1'), 'comment'::public.share_perm,
  'Guest의 edit 행은 comment로 깎인다');
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, title, sort_order)
    values ('10000000-0000-0000-0000-0000000000c0', '20000000-0000-0000-0000-0000000000c1', '게스트 작업', 1)$$,
  'P0001', 'forbidden', 'Guest는 작업을 직접 넣을 수 없다');
select throws_ok(
  $$select public.create_task('20000000-0000-0000-0000-0000000000c1', '게스트 작업')$$,
  'P0001', 'forbidden', 'Guest는 create_task를 호출할 수 없다');
with u as (update public.tasks set title = '게스트 수정' where id = '30000000-0000-0000-0000-0000000000c1' returning 1)
select is(count(*), 0::bigint, 'Guest의 작업 수정은 0행') from u;
select lives_ok(
  $$insert into public.comments (task_id, author_id, body)
    values ('30000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', '게스트 댓글')$$,
  'Guest는 구성원 프로젝트에 댓글을 단다');
select lives_ok(
  $$insert into public.comment_reactions (comment_id, user_id, emoji)
    select c.id, '00000000-0000-0000-0000-0000000000c3', '👍' from public.comments c where c.body = '게스트 댓글'$$,
  'Guest는 반응을 남긴다');
select is_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-0000000000c3'$$,
  'Guest는 비구성원 공개 프로젝트 작업을 볼 수 없다');
select is_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-0000000000c2'$$,
  'Guest는 비공개 프로젝트 작업을 볼 수 없다');

-- ─────────────────────────────────────────────
-- 소유자는 비공개 프로젝트도 본다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select isnt_empty($$select 1 from public.files where project_id = '20000000-0000-0000-0000-0000000000c2'$$,
  'Owner는 비공개 프로젝트 파일을 본다');

reset role;
select * from finish();
rollback;
