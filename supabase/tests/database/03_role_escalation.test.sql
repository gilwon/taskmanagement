-- 역할·권한 자기 상승과 owner 보호 규칙(거부 사례 4)을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ─────────────────────────────────────────────
-- 픽스처
-- o 유일한 owner, a admin, m member(프로젝트 p에 view 행), m2 member
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'member@example.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'member2@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000000d0', '워크스페이스', 'ws-d', '00000000-0000-0000-0000-0000000000d1');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d1', 'owner'),
  ('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d2', 'admin'),
  ('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d3', 'member'),
  ('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d4', 'member');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d0', 'PD', '프로젝트', 'workspace'),
  ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000d0', 'PX', '비공개', 'private');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3', 'view');

-- ─────────────────────────────────────────────
-- 구성원
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

select throws_ok(
  $$update public.workspace_members set role = 'admin'
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d3'$$,
  'P0001', 'self_role_change', 'Member는 자기 role을 admin으로 바꿀 수 없다');
select throws_ok(
  $$select public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d3', 'admin')$$,
  'P0001', 'self_role_change', 'Member는 set_member_role로도 자기 role을 바꿀 수 없다');
with u as (
  update public.workspace_members set role = 'admin'
  where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d4'
  returning 1)
select is(count(*), 0::bigint, 'Member는 다른 구성원 role을 바꿀 수 없다(0행)') from u;
select lives_ok(
  $$update public.workspace_members set title = '프론트엔드 엔지니어', tz = 'Asia/Tokyo'
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d3'$$,
  'Member는 자기 title·tz를 바꿀 수 있다');
select throws_ok(
  $$update public.workspace_members set color = 'rose'
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d3'$$,
  'P0001', 'forbidden', 'Member는 자기 color를 바꿀 수 없다');

with u as (
  update public.project_members set perm = 'full'
  where project_id = '20000000-0000-0000-0000-0000000000d1' and user_id = '00000000-0000-0000-0000-0000000000d3'
  returning 1)
select is(count(*), 0::bigint, 'Member는 자기 프로젝트 perm을 올릴 수 없다(0행)') from u;
select is(
  (select perm from public.project_members
   where project_id = '20000000-0000-0000-0000-0000000000d1' and user_id = '00000000-0000-0000-0000-0000000000d3'),
  'view'::public.share_perm, '자기 perm은 view로 남아 있다');
select throws_ok(
  $$insert into public.project_members (project_id, user_id, perm)
    values ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3', 'full')$$,
  'P0001', 'forbidden', 'Member는 비공개 프로젝트에 자신을 추가할 수 없다');

-- ─────────────────────────────────────────────
-- 관리자
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);

select throws_ok(
  $$select public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d1', 'member')$$,
  'P0001', 'owner_only', 'Admin은 owner를 강등할 수 없다');
select throws_ok(
  $$select public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d3', 'owner')$$,
  'P0001', 'owner_only', 'Admin은 owner를 부여할 수 없다');
select throws_ok(
  $$delete from public.workspace_members
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'P0001', 'owner_only', 'Admin은 owner를 제거할 수 없다');
select is(
  (public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d4', 'admin')).role,
  'admin'::public.ws_role, 'Admin은 member를 admin으로 올릴 수 있다');

-- ─────────────────────────────────────────────
-- 소유자
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

select throws_ok(
  $$delete from public.workspace_members
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'P0001', 'last_owner', '마지막 owner는 제거할 수 없다');
select throws_ok(
  $$select public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d1', 'member')$$,
  'P0001', 'self_role_change', 'Owner도 자기 role은 바꿀 수 없다');
select is(
  (public.set_member_role('10000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d2', 'owner')).role,
  'owner'::public.ws_role, 'Owner는 다른 사람에게 owner를 부여할 수 있다');
select lives_ok(
  $$delete from public.workspace_members
    where workspace_id = '10000000-0000-0000-0000-0000000000d0' and user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'owner가 둘이면 한 명은 나갈 수 있다');

reset role;
select * from finish();
rollback;
