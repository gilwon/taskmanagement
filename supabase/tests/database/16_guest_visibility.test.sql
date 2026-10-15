-- 게스트 구성원 가시성(011)과 create_project 리드 소속 검사를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ─────────────────────────────────────────────
-- 픽스처
-- W1. o owner, m1 member(PRV 구성원), m2 member(PRV 비구성원), g guest(PRV comment), x member(PRV 비구성원)
-- W2. g·x 둘 다 member. g는 W2에서 x와 워크스페이스를 공유한다
-- u는 어느 워크스페이스에도 없는 사람
-- PRV는 비공개라 project_members 행이 없는 m2·x는 볼 수 없다
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000016a1', 'owner@guestvis.test'),
  ('00000000-0000-0000-0000-0000000016a2', 'm1@guestvis.test'),
  ('00000000-0000-0000-0000-0000000016a3', 'm2@guestvis.test'),
  ('00000000-0000-0000-0000-0000000016a4', 'guest@guestvis.test'),
  ('00000000-0000-0000-0000-0000000016a5', 'x@guestvis.test'),
  ('00000000-0000-0000-0000-0000000016a6', 'outsider@guestvis.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000016b1', '가시성', 'guestvis-w1', '00000000-0000-0000-0000-0000000016a1'),
  ('10000000-0000-0000-0000-0000000016b2', '다른 곳', 'guestvis-w2', '00000000-0000-0000-0000-0000000016a5');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016a2', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016a3', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016a4', 'guest', 'active'),
  ('10000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016a5', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000016b2', '00000000-0000-0000-0000-0000000016a5', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000016b2', '00000000-0000-0000-0000-0000000016a4', 'member', 'active');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-0000000016c1', '10000000-0000-0000-0000-0000000016b1', 'PRV', '비공개', 'private');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016a2', 'edit'),
  ('20000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016a4', 'comment');

select ok(not has_function_privilege('anon', 'public.guest_shares_project(uuid, uuid)', 'execute'),
  'anon은 guest_shares_project를 실행할 수 없다');

set local role authenticated;

-- ─────────────────────────────────────────────
-- 게스트 g
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a4","role":"authenticated"}', true);
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000016a4'), 1::bigint,
  '게스트는 자기 프로필을 본다');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000016a2'), 1::bigint,
  '게스트는 공유 프로젝트 구성원의 프로필을 본다');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000016a1'), 1::bigint,
  '게스트는 공유 프로젝트를 볼 수 있는 owner의 프로필을 본다');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000016a3'), 0::bigint,
  '게스트는 프로젝트를 공유하지 않는 구성원의 프로필을 볼 수 없다');
select is((select count(*) from public.workspace_members
           where workspace_id = '10000000-0000-0000-0000-0000000016b1' and user_id = '00000000-0000-0000-0000-0000000016a4'),
  1::bigint, '게스트는 자기 구성원 행을 본다');
select is((select count(*) from public.workspace_members
           where workspace_id = '10000000-0000-0000-0000-0000000016b1' and user_id = '00000000-0000-0000-0000-0000000016a2'),
  1::bigint, '게스트는 공유 프로젝트 구성원의 구성원 행을 본다');
select is((select count(*) from public.workspace_members
           where workspace_id = '10000000-0000-0000-0000-0000000016b1' and user_id = '00000000-0000-0000-0000-0000000016a3'),
  0::bigint, '게스트는 프로젝트를 공유하지 않는 구성원의 구성원 행을 볼 수 없다');
select is((select count(*) from public.workspace_members where workspace_id = '10000000-0000-0000-0000-0000000016b1'),
  3::bigint, '게스트에게 W1 구성원은 자신·owner·공유 구성원 3명만 보인다');

-- 다른 워크스페이스(W2)에서 member로 같이 있는 x는 프로필이 보이지만 W1 구성원 행은 보이지 않는다
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000016a5'), 1::bigint,
  '게스트가 다른 워크스페이스에서 member로 공유하는 사람의 프로필은 보인다');
select is((select count(*) from public.workspace_members
           where workspace_id = '10000000-0000-0000-0000-0000000016b1' and user_id = '00000000-0000-0000-0000-0000000016a5'),
  0::bigint, '게스트인 워크스페이스의 구성원 행은 다른 워크스페이스 공유로 열리지 않는다');

-- ─────────────────────────────────────────────
-- member m2. 게스트가 아니면 전원 보인다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a3","role":"authenticated"}', true);
select is((select count(*) from public.workspace_members where workspace_id = '10000000-0000-0000-0000-0000000016b1'),
  5::bigint, 'member는 워크스페이스 구성원 전원의 행을 본다');
select is((select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-0000000016a%'),
  5::bigint, 'member는 워크스페이스 구성원 전원의 프로필을 본다');

-- 비구성원 u는 아무도 보지 못한다(자기 프로필만)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a6","role":"authenticated"}', true);
select is((select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-0000000016a%'),
  1::bigint, '비구성원은 자기 프로필만 본다');

-- ─────────────────────────────────────────────
-- create_project 리드 소속 검사(SEC-002)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_project('10000000-0000-0000-0000-0000000016b1', 'Lead Out', p_lead => '00000000-0000-0000-0000-0000000016a6')$$,
  'P0001', 'invalid_assignee', '워크스페이스 구성원이 아닌 사람은 리드로 지정할 수 없다');
select lives_ok(
  $$select public.create_project('10000000-0000-0000-0000-0000000016b1', 'Lead In', p_lead => '00000000-0000-0000-0000-0000000016a2')$$,
  '워크스페이스 구성원은 리드로 지정할 수 있다');

select * from finish();
rollback;
