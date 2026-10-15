-- 즐겨찾기 대상의 워크스페이스 일치·조회 권한과 작업·서브태스크 담당자의 워크스페이스 소속 검사를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ─────────────────────────────────────────────
-- 픽스처
-- 워크스페이스 A. o owner, m member, i invited, d deactivated(작업 배정 후 비활성화)
-- 워크스페이스 B. x owner(A 구성원 아님)
-- PA 공개, PP 비공개(m은 project_members 행이 없어 못 본다), PB는 B 소속
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000eb01', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000eb02', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000eb03', 'i@example.test'),
  ('00000000-0000-0000-0000-00000000eb04', 'd@example.test'),
  ('00000000-0000-0000-0000-00000000eb05', 'x@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000eba0', '워크스페이스 A', 'ws-eba', '00000000-0000-0000-0000-00000000eb01'),
  ('10000000-0000-0000-0000-00000000ebb0', '워크스페이스 B', 'ws-ebb', '00000000-0000-0000-0000-00000000eb05');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-00000000eba0', '00000000-0000-0000-0000-00000000eb01', 'owner', 'active'),
  ('10000000-0000-0000-0000-00000000eba0', '00000000-0000-0000-0000-00000000eb02', 'member', 'active'),
  ('10000000-0000-0000-0000-00000000eba0', '00000000-0000-0000-0000-00000000eb03', 'member', 'invited'),
  ('10000000-0000-0000-0000-00000000eba0', '00000000-0000-0000-0000-00000000eb04', 'member', 'active'),
  ('10000000-0000-0000-0000-00000000ebb0', '00000000-0000-0000-0000-00000000eb05', 'owner', 'active');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000eba0', '10000000-0000-0000-0000-00000000eba0', 'PA', 'A', 'workspace'),
  ('20000000-0000-0000-0000-00000000ebc0', '10000000-0000-0000-0000-00000000eba0', 'PP', 'P', 'private'),
  ('20000000-0000-0000-0000-00000000ebb0', '10000000-0000-0000-0000-00000000ebb0', 'PB', 'B', 'workspace');

-- ta 일반, td 비활성화 전에 d에게 배정된 작업, tr d에게 배정된 매주 반복 작업, tp 비공개, tb B 소속
insert into public.tasks (id, workspace_id, project_id, key, title, sort_order, assignee_id, recur, due_date) values
  ('30000000-0000-0000-0000-00000000eba1', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0', 'PA-101', 'ta', 1, null, 'none', null),
  ('30000000-0000-0000-0000-00000000eba2', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0', 'PA-102', 'td', 2, '00000000-0000-0000-0000-00000000eb04', 'none', null),
  ('30000000-0000-0000-0000-00000000eba3', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0', 'PA-103', 'tr', 3, '00000000-0000-0000-0000-00000000eb04', 'weekly', '2026-10-20'),
  ('30000000-0000-0000-0000-00000000ebc1', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000ebc0', 'PP-101', 'tp', 1, null, 'none', null),
  ('30000000-0000-0000-0000-00000000ebb1', '10000000-0000-0000-0000-00000000ebb0', '20000000-0000-0000-0000-00000000ebb0', 'PB-101', 'tb', 1, null, 'none', null);

-- 변환 대상. sd는 d 담당(비활성화 전 배정), si는 i(invited) 담당
insert into public.subtasks (id, task_id, title, assignee_id) values
  ('60000000-0000-0000-0000-00000000eba2', '30000000-0000-0000-0000-00000000eba1', 'sd', '00000000-0000-0000-0000-00000000eb04'),
  ('60000000-0000-0000-0000-00000000eba3', '30000000-0000-0000-0000-00000000eba1', 'si', '00000000-0000-0000-0000-00000000eb03');

-- d는 배정을 받은 뒤 비활성화된다
update public.workspace_members set status = 'deactivated'
where workspace_id = '10000000-0000-0000-0000-00000000eba0' and user_id = '00000000-0000-0000-0000-00000000eb04';

insert into public.subtasks (id, task_id, title) values
  ('60000000-0000-0000-0000-00000000eba1', '30000000-0000-0000-0000-00000000eba1', 's');

-- ─────────────────────────────────────────────
-- 1. 즐겨찾기. 볼 수 없는 대상(다른 워크스페이스, 비공개, 없는 id)은 모두 42501
-- ─────────────────────────────────────────────
-- postgres는 RLS를 받지 않으므로 복합 FK만 따로 확인한다
select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, task_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '30000000-0000-0000-0000-00000000ebb1')$$,
  '23503', null, '다른 워크스페이스 작업은 즐겨찾기 행으로 들어갈 수 없다(복합 FK)');
select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, project_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000ebb0')$$,
  '23503', null, '다른 워크스페이스 프로젝트는 즐겨찾기 행으로 들어갈 수 없다(복합 FK)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000eb02","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, task_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '30000000-0000-0000-0000-00000000ebb1')$$,
  '42501', null, '내 워크스페이스 id로 다른 워크스페이스 작업을 즐겨찾기할 수 없다');
select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, task_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '30000000-0000-0000-0000-0000000eeee1')$$,
  '42501', null, '없는 작업 id도 같은 42501이라 존재 여부가 새지 않는다');
select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, project_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000ebb0')$$,
  '42501', null, '내 워크스페이스 id로 다른 워크스페이스 프로젝트를 즐겨찾기할 수 없다');
select throws_ok(
  $$insert into public.favorites (user_id, workspace_id, task_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '30000000-0000-0000-0000-00000000ebc1')$$,
  '42501', null, '볼 수 없는 비공개 프로젝트의 작업은 즐겨찾기할 수 없다');
select lives_ok(
  $$insert into public.favorites (user_id, workspace_id, task_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '30000000-0000-0000-0000-00000000eba1')$$,
  '볼 수 있는 작업은 즐겨찾기할 수 있다');
select lives_ok(
  $$insert into public.favorites (user_id, workspace_id, project_id)
    values ('00000000-0000-0000-0000-00000000eb02', '10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0')$$,
  '볼 수 있는 프로젝트는 즐겨찾기할 수 있다');

-- ─────────────────────────────────────────────
-- 2. 작업 담당자. active·invited 구성원만 새로 배정, 비활성 담당자는 기존 배정만 유지
-- ─────────────────────────────────────────────
select throws_ok(
  $$update public.tasks set assignee_id = '00000000-0000-0000-0000-00000000eb05'
    where id = '30000000-0000-0000-0000-00000000eba1'$$,
  'P0001', 'invalid_assignee', '다른 워크스페이스 사람을 담당자로 바꿀 수 없다');
select throws_ok(
  $$select public.create_task('20000000-0000-0000-0000-00000000eba0', 'n', 'todo', 'medium', '00000000-0000-0000-0000-00000000eb05')$$,
  'P0001', 'invalid_assignee', 'create_task도 구성원이 아닌 담당자를 거부한다');
select throws_ok(
  $$update public.tasks set assignee_id = '00000000-0000-0000-0000-00000000eb04'
    where id = '30000000-0000-0000-0000-00000000eba1'$$,
  'P0001', 'invalid_assignee', '비활성 구성원에게 새로 배정할 수 없다');
select lives_ok(
  $$update public.tasks set assignee_id = '00000000-0000-0000-0000-00000000eb03'
    where id = '30000000-0000-0000-0000-00000000eba1'$$,
  '초대 중(invited) 구성원에게는 배정할 수 있다');
select lives_ok(
  $$update public.tasks set title = 'td2', assignee_id = '00000000-0000-0000-0000-00000000eb04'
    where id = '30000000-0000-0000-0000-00000000eba2'$$,
  '비활성 담당자가 이미 배정된 작업은 담당자를 그대로 둔 채 수정할 수 있다');

-- 클라이언트가 recur_source_id를 넣어 회차 예외로 검사를 피할 수 없다(guard_task_insert가 먼저 지운다)
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, key, title, sort_order, assignee_id, recur_source_id, created_by)
    values ('10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0', null, 'f', 9,
            '00000000-0000-0000-0000-00000000eb04', '30000000-0000-0000-0000-00000000eba2',
            '00000000-0000-0000-0000-00000000eb02')$$,
  'P0001', 'invalid_assignee', '회차 원본을 위조해도 비활성 구성원에게 새로 배정할 수 없다');

-- 반복 다음 회차는 원본 담당자를 그대로 옮긴다(기존 배정 유지)
select lives_ok($$select public.complete_task('30000000-0000-0000-0000-00000000eba3')$$,
  '비활성 담당자의 반복 작업도 완료할 수 있다');
select is(
  (select assignee_id from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000eba3'),
  '00000000-0000-0000-0000-00000000eb04'::uuid, '다음 회차는 원본 담당자를 이어받는다');

-- ─────────────────────────────────────────────
-- 3. 서브태스크 담당자
-- ─────────────────────────────────────────────
select throws_ok(
  $$insert into public.subtasks (task_id, title, assignee_id)
    values ('30000000-0000-0000-0000-00000000eba1', 's2', '00000000-0000-0000-0000-00000000eb05')$$,
  'P0001', 'invalid_assignee', '서브태스크에 다른 워크스페이스 사람을 배정할 수 없다');
select throws_ok(
  $$update public.subtasks set assignee_id = '00000000-0000-0000-0000-00000000eb04'
    where id = '60000000-0000-0000-0000-00000000eba1'$$,
  'P0001', 'invalid_assignee', '서브태스크에 비활성 구성원을 새로 배정할 수 없다');

-- 변환. 배정할 수 없는 담당자는 비우고 변환은 성공한다. 배정 가능한 담당자는 그대로 옮긴다.
select lives_ok($$select public.convert_subtask('60000000-0000-0000-0000-00000000eba2')$$,
  '비활성 구성원이 담당한 서브태스크도 작업으로 변환할 수 있다');
select is(
  (select assignee_id from public.tasks where project_id = '20000000-0000-0000-0000-00000000eba0' and title = 'sd'),
  null::uuid, '변환된 작업의 담당자는 비워진다');
select is(
  (select (public.convert_subtask('60000000-0000-0000-0000-00000000eba3')).assignee_id),
  '00000000-0000-0000-0000-00000000eb03'::uuid, '초대 중 구성원 담당자는 변환 후에도 그대로다');

-- ─────────────────────────────────────────────
-- 4. auth.uid()가 없는 경로(시드·관리 작업)도 같은 규칙
-- ─────────────────────────────────────────────
reset role;
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, key, title, sort_order, assignee_id)
    values ('10000000-0000-0000-0000-00000000eba0', '20000000-0000-0000-0000-00000000eba0', 'PA-190', 'p', 9,
            '00000000-0000-0000-0000-00000000eb05')$$,
  'P0001', 'invalid_assignee', 'postgres로 넣어도 구성원이 아닌 담당자는 거부한다');

select * from finish();
rollback;
