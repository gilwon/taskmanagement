-- 구성원 집계(010). 담당 작업 기준 참여 프로젝트 수·열린 작업 수를 세고, 부른 사람의 RLS 범위만 센다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, m member, g guest
-- PUB 공개, PRV 비공개(m은 구성원 아님), ARC 보관된 프로젝트, DEL 삭제된 프로젝트
-- m 담당 작업. PUB 열림·완료·보관·삭제 각 1, PRV 열림 1, ARC 열림 1, DEL 열림 1
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'owner@stats.test'),
  ('00000000-0000-0000-0000-0000000015a2', 'member@stats.test'),
  ('00000000-0000-0000-0000-0000000015a3', 'guest@stats.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000015b1', '집계', 'stats-w1', '00000000-0000-0000-0000-0000000015a1');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-0000000015a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-0000000015a2', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-0000000015a3', 'guest', 'active');

insert into public.projects (id, workspace_id, key, name, access, archived_at, deleted_at) values
  ('20000000-0000-0000-0000-0000000015c1', '10000000-0000-0000-0000-0000000015b1', 'PUB', '공개', 'workspace', null, null),
  ('20000000-0000-0000-0000-0000000015c2', '10000000-0000-0000-0000-0000000015b1', 'PRV', '비공개', 'private', null, null),
  ('20000000-0000-0000-0000-0000000015c3', '10000000-0000-0000-0000-0000000015b1', 'ARC', '보관', 'workspace', now(), null),
  ('20000000-0000-0000-0000-0000000015c4', '10000000-0000-0000-0000-0000000015b1', 'DEL', '삭제', 'workspace', null, now());

insert into public.tasks (workspace_id, project_id, key, title, status, assignee_id, archived_at, deleted_at, sort_order) values
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c1', 'PUB-1', '열림', 'todo', '00000000-0000-0000-0000-0000000015a2', null, null, 1),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c1', 'PUB-2', '완료', 'done', '00000000-0000-0000-0000-0000000015a2', null, null, 2),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c1', 'PUB-3', '보관', 'todo', '00000000-0000-0000-0000-0000000015a2', now(), null, 3),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c1', 'PUB-4', '삭제', 'todo', '00000000-0000-0000-0000-0000000015a2', null, now(), 4),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c2', 'PRV-1', '비공개', 'todo', '00000000-0000-0000-0000-0000000015a2', null, null, 1),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c3', 'ARC-1', '보관 프로젝트', 'todo', '00000000-0000-0000-0000-0000000015a2', null, null, 1),
  ('10000000-0000-0000-0000-0000000015b1', '20000000-0000-0000-0000-0000000015c4', 'DEL-1', '삭제 프로젝트', 'todo', '00000000-0000-0000-0000-0000000015a2', null, null, 1);

select ok(not has_function_privilege('anon', 'public.workspace_member_stats(uuid)', 'execute'),
  'anon은 구성원 집계를 실행할 수 없다');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}', true);
select is(
  (select project_count from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')
   where user_id = '00000000-0000-0000-0000-0000000015a2'),
  2, '보관·삭제된 프로젝트를 뺀 담당 프로젝트 수를 센다');
select is(
  (select task_count from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')
   where user_id = '00000000-0000-0000-0000-0000000015a2'),
  2, '완료·보관·삭제된 작업을 뺀 열린 작업 수를 센다');
select is((select count(*) from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')), 1::bigint,
  '담당 작업이 없는 구성원은 행이 없다');

-- 부른 사람의 RLS 범위만 센다. m은 비공개 프로젝트를 못 보고, g는 아무 프로젝트도 못 본다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
select is(
  (select row(project_count, task_count)::text from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')),
  '(1,1)', '볼 수 없는 비공개 프로젝트의 작업은 세지 않는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a3","role":"authenticated"}', true);
select is((select count(*) from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')), 0::bigint,
  '게스트는 추가되지 않은 프로젝트의 작업을 세지 못한다');

-- 다른 워크스페이스 비구성원은 아무것도 세지 못한다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015ff","role":"authenticated"}', true);
select is((select count(*) from public.workspace_member_stats('10000000-0000-0000-0000-0000000015b1')), 0::bigint,
  '비구성원은 집계를 볼 수 없다');

select * from finish();
rollback;
