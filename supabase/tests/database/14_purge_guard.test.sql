-- 영구 삭제 가드(009). Storage 객체가 남은 프로젝트·파일은 purge가 files_remain으로 거부한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, m member
-- P1 객체가 남은 삭제된 프로젝트, P2 객체가 없는 삭제된 프로젝트, P3 살아 있는 프로젝트
-- F1 객체가 남은 삭제된 파일, F2 객체가 없는 삭제된 파일(둘 다 P3)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'owner@purge.test'),
  ('00000000-0000-0000-0000-0000000014a2', 'member@purge.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000014b1', '영구 삭제', 'purge-w1', '00000000-0000-0000-0000-0000000014a1');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-0000000014a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-0000000014a2', 'member', 'active');

insert into public.projects (id, workspace_id, key, name, access, deleted_at) values
  ('20000000-0000-0000-0000-0000000014c1', '10000000-0000-0000-0000-0000000014b1', 'PA', '객체 남음', 'workspace', now()),
  ('20000000-0000-0000-0000-0000000014c2', '10000000-0000-0000-0000-0000000014b1', 'PB', '객체 없음', 'workspace', now()),
  ('20000000-0000-0000-0000-0000000014c3', '10000000-0000-0000-0000-0000000014b1', 'PC', '살아 있음', 'workspace', null);

insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, deleted_at) values
  ('40000000-0000-0000-0000-0000000014e1', '10000000-0000-0000-0000-0000000014b1', '20000000-0000-0000-0000-0000000014c3',
   'a.pdf', 'a.pdf', 'application/pdf', 1,
   '10000000-0000-0000-0000-0000000014b1/20000000-0000-0000-0000-0000000014c3/40000000-0000-0000-0000-0000000014e1/a.pdf',
   'ready', now()),
  ('40000000-0000-0000-0000-0000000014e2', '10000000-0000-0000-0000-0000000014b1', '20000000-0000-0000-0000-0000000014c3',
   'b.pdf', 'b.pdf', 'application/pdf', 1,
   '10000000-0000-0000-0000-0000000014b1/20000000-0000-0000-0000-0000000014c3/40000000-0000-0000-0000-0000000014e2/b.pdf',
   'ready', now());

-- P1 아래 객체 하나와 F1 객체. P2·F2 객체는 앱이 이미 지운 상태로 본다
insert into storage.objects (bucket_id, name, metadata) values
  ('files', '10000000-0000-0000-0000-0000000014b1/20000000-0000-0000-0000-0000000014c1/40000000-0000-0000-0000-0000000014e9/x.pdf',
   '{"size": 1}'),
  ('files', '10000000-0000-0000-0000-0000000014b1/20000000-0000-0000-0000-0000000014c3/40000000-0000-0000-0000-0000000014e1/a.pdf',
   '{"size": 1}');

select ok(not has_function_privilege('anon', 'public.purge_project(uuid)', 'execute'), 'anon은 purge_project를 실행할 수 없다');
select ok(not has_function_privilege('anon', 'public.purge_file(uuid)', 'execute'), 'anon은 purge_file을 실행할 수 없다');

set local role authenticated;

-- 권한 판정이 객체 확인보다 먼저다(관리 권한 없는 사람에게 남은 파일 여부를 알리지 않는다)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000014a2","role":"authenticated"}', true);
select throws_ok(
  $$select public.purge_project('20000000-0000-0000-0000-0000000014c1')$$,
  'P0001', 'forbidden', '관리 권한이 없으면 객체가 남아 있어도 forbidden');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.purge_project('20000000-0000-0000-0000-0000000014c1')$$,
  'P0001', 'files_remain', '객체가 남은 프로젝트는 영구 삭제할 수 없다');
select is((select count(*) from public.projects where id = '20000000-0000-0000-0000-0000000014c1'), 1::bigint,
  '거부된 프로젝트는 그대로 남는다');
select lives_ok(
  $$select public.purge_project('20000000-0000-0000-0000-0000000014c2')$$,
  '같은 워크스페이스의 다른 프로젝트 객체는 영향을 주지 않는다');
select is((select count(*) from public.projects where id = '20000000-0000-0000-0000-0000000014c2'), 0::bigint,
  '객체가 없는 프로젝트는 지워진다');

select throws_ok(
  $$select public.purge_file('40000000-0000-0000-0000-0000000014e1')$$,
  'P0001', 'files_remain', '객체가 남은 파일은 영구 삭제할 수 없다');
select lives_ok(
  $$select public.purge_file('40000000-0000-0000-0000-0000000014e2')$$,
  '객체가 없는 파일은 영구 삭제할 수 있다');
select is((select count(*) from public.files where id in ('40000000-0000-0000-0000-0000000014e1', '40000000-0000-0000-0000-0000000014e2')),
  1::bigint, '객체가 남은 파일 행만 남는다');

select * from finish();
rollback;
