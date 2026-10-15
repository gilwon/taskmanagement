-- 워크스페이스 간 격리(거부 사례 1)와 anon 차단(거부 사례 8)을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ─────────────────────────────────────────────
-- 픽스처(postgres 권한으로 직접 만든다. 시드에 의존하지 않는다)
-- 사용자 A는 워크스페이스 A의 owner, 사용자 B는 워크스페이스 B의 owner
-- ─────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', '{"name":"사용자 A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test', '{"name":"사용자 B"}');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000000a', '워크스페이스 A', 'ws-a', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000b', '워크스페이스 B', 'ws-b', '00000000-0000-0000-0000-0000000000b1');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

insert into public.projects (id, workspace_id, key, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'AA', '프로젝트 A'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'BB', '프로젝트 B');

insert into public.tasks (id, workspace_id, project_id, key, title, sort_order) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'AA-100', 'A 작업', 1000),
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'BB-100', 'B 작업', 1000);

insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B 댓글');

insert into public.files (id, workspace_id, project_id, name, object_name, type, mime, size_bytes, storage_path, status, uploaded_by) values
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b',
   'b.pdf', 'b.pdf', 'pdf', 'application/pdf', 1024,
   '10000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-00000000000b/50000000-0000-0000-0000-00000000000b/b.pdf',
   'ready', '00000000-0000-0000-0000-0000000000b1');

-- ─────────────────────────────────────────────
-- 사용자 A로 전환
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is_empty($$select 1 from public.projects where id = '20000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스 프로젝트를 볼 수 없다');
select is_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스 작업을 볼 수 없다');
select is_empty($$select 1 from public.comments where id = '40000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스 댓글을 볼 수 없다');
select is_empty($$select 1 from public.files where id = '50000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스 파일을 볼 수 없다');

with u as (update public.tasks set title = '침범' where id = '30000000-0000-0000-0000-00000000000b' returning 1)
select is(count(*), 0::bigint, 'A의 B 작업 수정은 0행') from u;
select throws_ok($$delete from public.tasks where id = '30000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'A의 B 작업 직접 삭제는 권한 오류다');
with u as (update public.projects set name = '침범' where id = '20000000-0000-0000-0000-00000000000b' returning 1)
select is(count(*), 0::bigint, 'A의 B 프로젝트 수정은 0행') from u;
select throws_ok($$delete from public.comments where id = '40000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'A의 B 댓글 직접 삭제는 권한 오류다');
with u as (update public.files set task_id = null where id = '50000000-0000-0000-0000-00000000000b' returning 1)
select is(count(*), 0::bigint, 'A의 B 파일 수정은 0행') from u;

select is_empty($$select 1 from public.workspaces where id = '10000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스를 볼 수 없다');
select is_empty($$select 1 from public.workspace_members where workspace_id = '10000000-0000-0000-0000-00000000000b'$$,
  'A는 B 워크스페이스 구성원을 볼 수 없다');
select is_empty($$select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'A는 워크스페이스를 공유하지 않는 B의 프로필을 볼 수 없다');

-- 키 발급 트리거가 편집 권한을 먼저 확인하므로 RLS(42501)보다 앞서 forbidden으로 막힌다
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, title, sort_order)
    values ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', '침범', 1)$$,
  'P0001', 'forbidden', 'A는 B 프로젝트에 작업을 직접 넣을 수 없다');
select throws_ok(
  $$select public.create_task('20000000-0000-0000-0000-00000000000b', '침범')$$,
  'P0001', 'not_found', 'A는 B 프로젝트에 create_task를 호출할 수 없다');

select isnt_empty($$select 1 from public.tasks where id = '30000000-0000-0000-0000-00000000000a'$$,
  'A는 자기 워크스페이스 작업을 본다');

-- ─────────────────────────────────────────────
-- 거부된 쓰기가 원본을 바꾸지 않았는지 postgres로 확인
-- ─────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select title from public.tasks where id = '30000000-0000-0000-0000-00000000000b'),
  'B 작업',
  'B 작업은 그대로 남아 있다');

-- ─────────────────────────────────────────────
-- anon은 테이블 권한 자체가 없다
-- ─────────────────────────────────────────────
set local role anon;
select throws_ok($$select * from public.tasks$$, '42501', null, 'anon은 tasks를 조회할 수 없다');
select throws_ok($$select * from public.projects$$, '42501', null, 'anon은 projects를 조회할 수 없다');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon은 profiles를 조회할 수 없다');
select throws_ok(
  $$select public.create_task('20000000-0000-0000-0000-00000000000a', '익명')$$,
  '42501', null, 'anon은 RPC를 실행할 수 없다');

reset role;
select * from finish();
rollback;
