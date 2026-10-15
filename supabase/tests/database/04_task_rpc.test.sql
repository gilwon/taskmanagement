-- 작업 키 발급(거부 사례 5), 반복 회차 중복 방지(6), 소프트 삭제 복원 토큰(7)을 검증한다.
--
-- 한계. pgTAP는 한 세션·한 트랜잭션에서 돌기 때문에 진짜 동시 요청(두 세션)은 재현할 수 없다.
-- 대신 동시성 보장의 근거를 고정한다.
--   키 발급은 private.next_task_seq의 update ... returning이 프로젝트 행을 잠가 직렬화한다.
--   반복 회차는 complete_task가 원본 작업 행을 for update로 잠그고, recur_source_id unique가 최종 방어선이다.
-- 두 세션 동시성은 별도 스크립트(psql 두 개)로 확인해야 한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ─────────────────────────────────────────────
-- 픽스처. o owner, m member(공개 프로젝트라 edit)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'member@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000000e0', '워크스페이스', 'ws-e', '00000000-0000-0000-0000-0000000000e1');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e1', 'owner'),
  ('10000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e2', 'member');

insert into public.projects (id, workspace_id, key, name) values
  ('20000000-0000-0000-0000-0000000000e0', '10000000-0000-0000-0000-0000000000e0', 'TK', '작업 프로젝트');

-- tr 매주 반복, td1·td2 삭제·복원용
insert into public.tasks (id, workspace_id, project_id, key, title, sort_order, recur, start_date, due_date) values
  ('30000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e0', '20000000-0000-0000-0000-0000000000e0',
   'TK-100', '주간 회의', 1000, 'weekly', '2026-10-01', '2026-10-02'),
  ('30000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000e0', '20000000-0000-0000-0000-0000000000e0',
   'TK-103', '삭제 후 복원', 2000, 'none', null, null),
  ('30000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000e0', '20000000-0000-0000-0000-0000000000e0',
   'TK-106', '삭제 후 수정됨', 3000, 'none', null, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);

-- ─────────────────────────────────────────────
-- 키 발급
-- ─────────────────────────────────────────────
select is((public.create_task('20000000-0000-0000-0000-0000000000e0', '첫 작업')).key, 'TK-201',
  '새 프로젝트 첫 작업 키는 201로 끝난다');
select is((public.create_task('20000000-0000-0000-0000-0000000000e0', '둘째 작업')).key, 'TK-202',
  '두 번째 호출은 다른 키(202)를 받는다');
select is((select seq from public.projects where id = '20000000-0000-0000-0000-0000000000e0'), 202,
  'seq가 호출마다 1씩 오른다');
select is(
  (select count(*) from public.activities
   where project_id = '20000000-0000-0000-0000-0000000000e0' and verb = 'created'),
  2::bigint, '작업 생성은 트리거가 created 활동을 남긴다');
select results_eq(
  $$insert into public.tasks (workspace_id, project_id, key, title, sort_order)
    values ('10000000-0000-0000-0000-0000000000e0', '20000000-0000-0000-0000-0000000000e0', 'TK-999', '직접 삽입', 1)
    returning key$$,
  array['TK-203'],
  '클라이언트가 넣은 키는 무시되고 seq로 발급된다');
select throws_ok(
  $$update public.projects set seq = 1 where id = '20000000-0000-0000-0000-0000000000e0'$$,
  'P0001', 'forbidden', '클라이언트는 seq를 직접 바꿀 수 없다');

-- ─────────────────────────────────────────────
-- 반복 작업 완료
-- ─────────────────────────────────────────────
select is((select next_due from public.complete_task('30000000-0000-0000-0000-0000000000e1')), '2026-10-09'::date,
  '매주 반복 완료 시 다음 회차 기한이 7일 뒤다');
select is(
  (select next_task_id from public.complete_task('30000000-0000-0000-0000-0000000000e1')),
  (select id from public.tasks where recur_source_id = '30000000-0000-0000-0000-0000000000e1'),
  '두 번째 완료는 기존 회차를 돌려준다');
select is(
  (select count(*) from public.tasks where recur_source_id = '30000000-0000-0000-0000-0000000000e1'),
  1::bigint, '완료를 두 번 해도 다음 회차는 정확히 1개');
select is(
  (select start_date from public.tasks where recur_source_id = '30000000-0000-0000-0000-0000000000e1'),
  '2026-10-08'::date, '시작일도 같은 간격만큼 옮겨진다');
select is(
  (select count(*) from public.activities
   where task_id = '30000000-0000-0000-0000-0000000000e1' and verb = 'completed'),
  1::bigint, 'completed 활동은 한 번만 남는다');
select is(
  (select status from public.tasks where id = '30000000-0000-0000-0000-0000000000e1'),
  'done'::public.task_status, '원본 작업은 done이다');

-- ─────────────────────────────────────────────
-- 소프트 삭제·복원 토큰
-- 토큰은 문자열로 보관했다가 그대로 돌려준다(앱도 같은 방식이어야 한다)
-- ─────────────────────────────────────────────
select isnt(
  set_config('test.tok1', public.soft_delete_task('30000000-0000-0000-0000-0000000000e2')::text, true),
  null, '소프트 삭제는 복원 토큰을 돌려준다');
select isnt_empty(
  $$select 1 from public.tasks where id = '30000000-0000-0000-0000-0000000000e2' and deleted_at is not null$$,
  '편집 권한자는 삭제된 작업을 보관함에서 본다');
select is(
  (public.restore_task('30000000-0000-0000-0000-0000000000e2', current_setting('test.tok1')::timestamptz)).deleted_at,
  null, '변경이 없으면 옛 토큰으로 복원된다');

select set_config('test.tok2', public.soft_delete_task('30000000-0000-0000-0000-0000000000e3')::text, true);
-- 삭제 이후 다른 수정이 일어나면 updated_at이 바뀐다(clock_timestamp)
update public.tasks set title = '다른 사용자가 수정' where id = '30000000-0000-0000-0000-0000000000e3';
select throws_ok(
  $$select public.restore_task('30000000-0000-0000-0000-0000000000e3', current_setting('test.tok2')::timestamptz)$$,
  'P0001', 'conflict', '삭제 후 바뀐 레코드는 복원하지 않는다');
select ok(
  (select deleted_at is not null from public.tasks where id = '30000000-0000-0000-0000-0000000000e3'),
  '충돌한 레코드는 삭제 상태로 남는다');
select throws_ok(
  $$select public.purge_task('30000000-0000-0000-0000-0000000000e3')$$,
  'P0001', 'forbidden', '편집 권한만으로는 영구 삭제할 수 없다');

reset role;
select * from finish();
rollback;
