-- 직접 DML로 휴지통·작성자·초대·파일 규칙을 우회하지 못하는지(2차 보안 리뷰)와 반복 회차가 모든 완료 경로에서 생기는지(R10)를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- ─────────────────────────────────────────────
-- 픽스처
-- 사용자 o owner, m member(공개 프로젝트라 edit), m2 member(PA full), v 워크스페이스 밖 사용자
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e901', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000e902', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000e904', 'm2@example.test'),
  ('00000000-0000-0000-0000-00000000e905', 'Victim@Example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000e900', '워크스페이스 구', 'ws-e9', '00000000-0000-0000-0000-00000000e901');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000e900', '00000000-0000-0000-0000-00000000e901', 'owner'),
  ('10000000-0000-0000-0000-00000000e900', '00000000-0000-0000-0000-00000000e902', 'member'),
  ('10000000-0000-0000-0000-00000000e900', '00000000-0000-0000-0000-00000000e904', 'member');

-- PZ·tz·cz·f5는 직접 delete 시도 대상이다(수정 전 코드에서 지워져도 다른 검사에 영향이 없게 따로 둔다)
insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000e9a0', '10000000-0000-0000-0000-00000000e900', 'PA', 'A', 'workspace'),
  ('20000000-0000-0000-0000-00000000e9f0', '10000000-0000-0000-0000-00000000e900', 'PZ', 'Z', 'workspace');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-00000000e9a0', '00000000-0000-0000-0000-00000000e904', 'full');

-- ta 일반, r1·r2·r3 매주 반복
insert into public.tasks (id, workspace_id, project_id, key, title, sort_order, recur, due_date) values
  ('30000000-0000-0000-0000-00000000e9a1', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'PA-101', 'ta', 1, 'none', null),
  ('30000000-0000-0000-0000-00000000e9b1', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'PA-102', 'r1', 2, 'weekly', '2026-10-20'),
  ('30000000-0000-0000-0000-00000000e9b2', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'PA-103', 'r2', 3, 'weekly', '2026-10-20'),
  ('30000000-0000-0000-0000-00000000e9b3', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'PA-104', 'r3', 4, 'weekly', '2026-10-20'),
  ('30000000-0000-0000-0000-00000000e9f1', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'PA-105', 'tz', 5, 'none', null);

insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-00000000e901', '30000000-0000-0000-0000-00000000e9a1', '00000000-0000-0000-0000-00000000e904', 'm2 says hi'),
  ('40000000-0000-0000-0000-00000000e9f1', '30000000-0000-0000-0000-00000000e9a1', '00000000-0000-0000-0000-00000000e904', 'cz');

-- f1 ready, f2 pending, f3 failed, f4 ready이지만 소프트 삭제, f5 ready(delete 시도 대상). 업로더는 모두 m2
insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by, deleted_at)
select ('50000000-0000-0000-0000-00000000e90' || v.n)::uuid, '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0',
       v.n || '.pdf', v.n || '.pdf', 'application/pdf', 1,
       '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e90' || v.n || '/' || v.n || '.pdf',
       v.status::public.file_status, '00000000-0000-0000-0000-00000000e904', v.deleted_at
from (values ('1', 'ready', null::timestamptz), ('2', 'pending', null), ('3', 'failed', null), ('4', 'ready', now()), ('5', 'ready', null))
  v(n, status, deleted_at);

insert into public.events (id, workspace_id, project_id, title, created_by, date) values
  ('60000000-0000-0000-0000-00000000e901', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0',
   'ev', '00000000-0000-0000-0000-00000000e904', '2026-10-20');
insert into public.saved_views (id, workspace_id, project_id, name, created_by) values
  ('80000000-0000-0000-0000-00000000e901', '10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0',
   'v', '00000000-0000-0000-0000-00000000e904');

-- 시드처럼 auth.uid() 없이 반복 작업을 완료하면 회차를 만들지 않는다
update public.tasks set status = 'done' where id = '30000000-0000-0000-0000-00000000e9b3';
select is_empty($$select 1 from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000e9b3'$$,
  'auth.uid()가 없는 완료는 반복 회차를 만들지 않는다');

set local role authenticated;

-- ─────────────────────────────────────────────
-- 1. 직접 DELETE로 휴지통을 건너뛰지 못한다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e901","role":"authenticated"}', true);
select throws_ok($$delete from public.projects where id = '20000000-0000-0000-0000-00000000e9f0'$$,
  '42501', null, 'owner도 프로젝트를 직접 delete할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e904","role":"authenticated"}', true);
select throws_ok($$delete from public.tasks where id = '30000000-0000-0000-0000-00000000e9f1'$$,
  '42501', null, '관리 권한자도 작업을 직접 delete할 수 없다');
select throws_ok($$delete from public.comments where id = '40000000-0000-0000-0000-00000000e9f1'$$,
  '42501', null, '작성자도 댓글을 직접 delete할 수 없다');
select throws_ok($$delete from public.files where id = '50000000-0000-0000-0000-00000000e905'$$,
  '42501', null, '파일 행을 직접 delete할 수 없다');

-- ─────────────────────────────────────────────
-- 2. deleted_at은 RPC로만 바꾼다(토큰 없는 복원 금지)
-- ─────────────────────────────────────────────
select isnt(set_config('test.tok', public.soft_delete_task(p_task => '30000000-0000-0000-0000-00000000e9a1')::text, true),
  null, 'soft_delete_task(p_task)로 소프트 삭제한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select throws_ok($$update public.tasks set deleted_at = null where id = '30000000-0000-0000-0000-00000000e9a1'$$,
  'P0001', 'forbidden', '삭제된 작업을 토큰 없이 직접 복원할 수 없다');
select throws_ok($$update public.tasks set deleted_at = now() where id = '30000000-0000-0000-0000-00000000e9b2'$$,
  'P0001', 'forbidden', '작업 deleted_at을 직접 채울 수 없다');
select throws_ok($$update public.files set deleted_at = now() where id = '50000000-0000-0000-0000-00000000e901'$$,
  '42501', null, '파일 deleted_at은 직접 바꿀 수 없다');
select lives_ok(
  $$select public.restore_task(p_task => '30000000-0000-0000-0000-00000000e9a1', p_token => current_setting('test.tok')::timestamptz)$$,
  'restore_task(p_task, p_token)으로는 복원된다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e901","role":"authenticated"}', true);
select throws_ok($$update public.projects set deleted_at = now() where id = '20000000-0000-0000-0000-00000000e9f0'$$,
  'P0001', 'forbidden', 'owner도 프로젝트 deleted_at을 직접 바꿀 수 없다');
with u as (update public.tasks set archived_at = now() where id = '30000000-0000-0000-0000-00000000e9b2' returning 1)
select is(count(*), 1::bigint, '작업 보관(archived_at)은 직접 바꿀 수 있다') from u;
select lives_ok($$select public.purge_task(p_task => '30000000-0000-0000-0000-00000000e9b2')$$,
  '보관된 작업은 purge_task(p_task)로 영구 삭제된다');
select is_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-00000000e9b2'$$,
  '영구 삭제된 작업은 사라진다');

-- ─────────────────────────────────────────────
-- 3. events·saved_views 작성자 위조
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select throws_ok(
  $$update public.events set created_by = '00000000-0000-0000-0000-00000000e901' where id = '60000000-0000-0000-0000-00000000e901'$$,
  'P0001', 'forbidden', 'events.created_by는 바꿀 수 없다');
select throws_ok(
  $$update public.saved_views set created_by = '00000000-0000-0000-0000-00000000e901' where id = '80000000-0000-0000-0000-00000000e901'$$,
  'P0001', 'forbidden', 'saved_views.created_by는 바꿀 수 없다');
with i as (
  insert into public.events (workspace_id, project_id, title, created_by, date)
  values ('10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'ev2',
          '00000000-0000-0000-0000-00000000e901', '2026-10-21')
  returning created_by
)
select is(created_by, '00000000-0000-0000-0000-00000000e902'::uuid, 'events insert의 created_by는 본인으로 덮인다') from i;
with i as (
  insert into public.saved_views (workspace_id, project_id, name, created_by)
  values ('10000000-0000-0000-0000-00000000e900', '20000000-0000-0000-0000-00000000e9a0', 'v2',
          '00000000-0000-0000-0000-00000000e901')
  returning created_by
)
select is(created_by, '00000000-0000-0000-0000-00000000e902'::uuid, 'saved_views insert의 created_by는 본인으로 덮인다') from i;

-- ─────────────────────────────────────────────
-- 4. 남의 댓글 본문 수정
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e901","role":"authenticated"}', true);
with u as (update public.comments set body = 'm2: 저는 사퇴합니다' where id = '40000000-0000-0000-0000-00000000e901' returning 1)
select is(count(*), 0::bigint, 'owner도 남의 댓글 본문은 고칠 수 없다') from u;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e904","role":"authenticated"}', true);
with u as (update public.comments set body = '고친 글' where id = '40000000-0000-0000-0000-00000000e901' returning 1)
select is(count(*), 1::bigint, '작성자는 자기 댓글 본문을 고친다') from u;

-- ─────────────────────────────────────────────
-- 5. Storage 객체 삭제 범위
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e901/1.pdf'),
  false, '편집자는 ready·미삭제 파일 객체를 지울 수 없다');
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e902/2.pdf'),
  true, '편집자는 pending 파일 객체를 정리할 수 있다');
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e904/4.pdf'),
  false, '편집자는 소프트 삭제된 파일 객체를 지울 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e901","role":"authenticated"}', true);
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e904/4.pdf'),
  true, '관리 권한자는 소프트 삭제된 파일 객체를 정리할 수 있다');
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000e900/20000000-0000-0000-0000-00000000e9a0/50000000-0000-0000-0000-00000000e901/1.pdf'),
  false, '관리 권한자도 쓰이는 파일 객체는 지울 수 없다');

-- ─────────────────────────────────────────────
-- 6. 동의 없는 구성원 추가와 초대 수락
-- ─────────────────────────────────────────────
select throws_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role, status)
    values ('10000000-0000-0000-0000-00000000e900', '00000000-0000-0000-0000-00000000e905', 'admin', 'active')$$,
  '42501', null, 'owner도 임의 사용자를 구성원으로 직접 넣을 수 없다');
select is_empty($$select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000e905'$$,
  '워크스페이스 밖 사용자의 프로필(이메일)은 보이지 않는다');
select lives_ok(
  $$insert into public.workspace_invites (id, workspace_id, email, role, invited_by)
    values ('90000000-0000-0000-0000-00000000e901', '10000000-0000-0000-0000-00000000e900', 'victim@example.test', 'admin',
            '00000000-0000-0000-0000-00000000e901')$$,
  'owner가 초대를 만든다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select is_empty($$select 1 from public.my_invites()$$, '다른 사람의 초대는 my_invites에 나오지 않는다');
select throws_ok($$select public.accept_invite(p_invite => '90000000-0000-0000-0000-00000000e901')$$,
  'P0001', 'not_found', '이메일이 다른 사람은 초대를 수락할 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e905","role":"authenticated"}', true);
select results_eq($$select workspace_name from public.my_invites()$$, array['워크스페이스 구'],
  '초대받은 본인은 이메일 대소문자와 무관하게 초대와 워크스페이스 이름을 본다');
select lives_ok($$select public.accept_invite(p_invite => '90000000-0000-0000-0000-00000000e901')$$,
  '초대받은 본인은 수락할 수 있다');
select is(
  (select role::text || '|' || status::text from public.workspace_members
   where workspace_id = '10000000-0000-0000-0000-00000000e900' and user_id = '00000000-0000-0000-0000-00000000e905'),
  'admin|active', '수락하면 초대 역할의 active 구성원이 된다');
select throws_ok($$select public.accept_invite('90000000-0000-0000-0000-00000000e901')$$,
  'P0001', 'not_found', '이미 처리된 초대는 다시 수락할 수 없다');

-- ─────────────────────────────────────────────
-- 7. retry_file 업로더 탈취
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select throws_ok($$select public.retry_file('50000000-0000-0000-0000-00000000e903')$$,
  'P0001', 'forbidden', '업로더가 아닌 편집자는 재시도할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e904","role":"authenticated"}', true);
select is((public.retry_file('50000000-0000-0000-0000-00000000e903')).uploaded_by, '00000000-0000-0000-0000-00000000e904'::uuid,
  '업로더 본인이 재시도하면 업로더는 그대로다');
select lives_ok($$select public.fail_file('50000000-0000-0000-0000-00000000e903')$$, '다시 실패 처리한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e901","role":"authenticated"}', true);
select is((public.retry_file('50000000-0000-0000-0000-00000000e903')).uploaded_by, '00000000-0000-0000-0000-00000000e901'::uuid,
  '관리 권한자가 대신 재시도하면 업로더가 관리자로 바뀐다');

-- ─────────────────────────────────────────────
-- 8. 반복 회차는 모든 완료 경로에서 생긴다(R10)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e902","role":"authenticated"}', true);
select lives_ok($$select public.move_task('30000000-0000-0000-0000-00000000e9b1', 'done')$$, 'move_task로 반복 작업을 done에 넣는다');
select is((select count(*) from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000e9b1'), 1::bigint,
  'move_task로 완료해도 다음 회차가 생긴다');
update public.tasks set status = 'todo' where id = '30000000-0000-0000-0000-00000000e9b1';
update public.tasks set status = 'done' where id = '30000000-0000-0000-0000-00000000e9b1';
select is((select count(*) from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000e9b1'), 1::bigint,
  '직접 update로 다시 완료해도 회차는 하나뿐이다');
select is((select due_date from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000e9b1'), '2026-10-27'::date,
  '다음 회차 기한은 7일 뒤다');

reset role;
select * from finish();
rollback;
