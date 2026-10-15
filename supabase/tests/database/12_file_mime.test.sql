-- finalize_file의 MIME 확인을 검증한다. 객체 MIME이 files.mime과 같으면 ready, 다르면 mime_mismatch로 거부하고
-- 앱 순서(오류 → fail_file)대로 failed가 된다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ─────────────────────────────────────────────
-- 픽스처. 사용자 o owner, m member. PA는 워크스페이스 공개
-- f1은 MIME 일치, f2는 .pdf 행에 text/plain 객체(위장)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ec01', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000ec02', 'm@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000ec00', '워크스페이스', 'ws-ec', '00000000-0000-0000-0000-00000000ec01');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000ec00', '00000000-0000-0000-0000-00000000ec01', 'owner'),
  ('10000000-0000-0000-0000-00000000ec00', '00000000-0000-0000-0000-00000000ec02', 'member');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000eca0', '10000000-0000-0000-0000-00000000ec00', 'PA', 'A', 'workspace');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ec02","role":"authenticated"}', true);

insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path) values
  ('50000000-0000-0000-0000-00000000ec01', '10000000-0000-0000-0000-00000000ec00', '20000000-0000-0000-0000-00000000eca0',
   'a.pdf', 'a.pdf', 'application/pdf', 100,
   '10000000-0000-0000-0000-00000000ec00/20000000-0000-0000-0000-00000000eca0/50000000-0000-0000-0000-00000000ec01/a.pdf'),
  ('50000000-0000-0000-0000-00000000ec02', '10000000-0000-0000-0000-00000000ec00', '20000000-0000-0000-0000-00000000eca0',
   'b.pdf', 'b.pdf', 'application/pdf', 100,
   '10000000-0000-0000-0000-00000000ec00/20000000-0000-0000-0000-00000000eca0/50000000-0000-0000-0000-00000000ec02/b.pdf');

insert into storage.objects (bucket_id, name, metadata) values
  ('files', '10000000-0000-0000-0000-00000000ec00/20000000-0000-0000-0000-00000000eca0/50000000-0000-0000-0000-00000000ec01/a.pdf',
   '{"size": 100, "mimetype": "application/pdf"}'),
  ('files', '10000000-0000-0000-0000-00000000ec00/20000000-0000-0000-0000-00000000eca0/50000000-0000-0000-0000-00000000ec02/b.pdf',
   '{"size": 100, "mimetype": "text/plain"}');

-- ─────────────────────────────────────────────
-- 일치 → ready
-- ─────────────────────────────────────────────
select is(
  (public.finalize_file('50000000-0000-0000-0000-00000000ec01')).status, 'ready'::public.file_status,
  '객체 MIME이 files.mime과 같으면 ready가 된다');

-- ─────────────────────────────────────────────
-- 불일치 → mime_mismatch, ready가 되지 않는다
-- ─────────────────────────────────────────────
select throws_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000ec02')$$,
  'P0001', 'mime_mismatch', '객체 MIME이 다르면 mime_mismatch로 거부한다');
select is(
  (select status from public.files where id = '50000000-0000-0000-0000-00000000ec02'), 'pending'::public.file_status,
  '거부된 finalize는 ready로 바꾸지 않는다');
select is(
  (public.fail_file('50000000-0000-0000-0000-00000000ec02')).status, 'failed'::public.file_status,
  '앱이 오류 뒤 fail_file을 부르면 failed가 된다');
select throws_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000ec02')$$,
  'P0001', 'mime_mismatch', 'failed 행도 MIME이 다르면 ready가 되지 않는다');

select * from finish();
rollback;
