-- files 버킷 설정과 storage.objects 정책(거부 사례 9)을 검증한다.
-- 객체는 같은 경로를 storage_path로 가진 files 행이 있을 때만 열린다.
-- files·객체 행은 postgres로 직접 넣는다(실제 파일 업로드 없이 정책만 확인).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ─────────────────────────────────────────────
-- 픽스처. 사용자 A는 워크스페이스 A owner, 사용자 B는 워크스페이스 B owner
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'b@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000000fa', '워크스페이스 A', 'ws-fa', '00000000-0000-0000-0000-0000000000f1'),
  ('10000000-0000-0000-0000-0000000000fb', '워크스페이스 B', 'ws-fb', '00000000-0000-0000-0000-0000000000f2');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000f1', 'owner'),
  ('10000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000f2', 'owner');

insert into public.projects (id, workspace_id, key, name) values
  ('20000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000fa', 'FA', '프로젝트 A'),
  ('20000000-0000-0000-0000-0000000000fb', '10000000-0000-0000-0000-0000000000fb', 'FB', '프로젝트 B');

-- a.pdf·b.pdf는 ready, d.pdf는 A가 만든 pending(업로드 대기) 행
insert into public.files (id, workspace_id, project_id, name, object_name, type, mime, size_bytes, storage_path, status, uploaded_by) values
  ('50000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000fa',
   'a.pdf', 'a.pdf', 'pdf', 'application/pdf', 10,
   '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/50000000-0000-0000-0000-0000000000f1/a.pdf',
   'ready', '00000000-0000-0000-0000-0000000000f1'),
  ('50000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000fb', '20000000-0000-0000-0000-0000000000fb',
   'b.pdf', 'b.pdf', 'pdf', 'application/pdf', 10,
   '10000000-0000-0000-0000-0000000000fb/20000000-0000-0000-0000-0000000000fb/50000000-0000-0000-0000-0000000000f2/b.pdf',
   'ready', '00000000-0000-0000-0000-0000000000f2'),
  ('50000000-0000-0000-0000-0000000000f5', '10000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000fa',
   'd.pdf', 'd.pdf', 'pdf', 'application/pdf', 10,
   '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/50000000-0000-0000-0000-0000000000f5/d.pdf',
   'pending', '00000000-0000-0000-0000-0000000000f1');

insert into storage.objects (bucket_id, name) values
  ('files', '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/50000000-0000-0000-0000-0000000000f1/a.pdf'),
  ('files', '10000000-0000-0000-0000-0000000000fb/20000000-0000-0000-0000-0000000000fb/50000000-0000-0000-0000-0000000000f2/b.pdf'),
  -- 첫 세그먼트는 A, 둘째는 B 프로젝트인 어긋난 경로(대응하는 files 행이 없다)
  ('files', '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fb/50000000-0000-0000-0000-0000000000f3/x.pdf');

-- ─────────────────────────────────────────────
-- 버킷 설정
-- ─────────────────────────────────────────────
select is((select public from storage.buckets where id = 'files'), false, 'files 버킷은 비공개다');
select is((select file_size_limit from storage.buckets where id = 'files'), 52428800::bigint, '파일당 상한은 50 MB다');
select ok(
  (select not ('image/svg+xml' = any (allowed_mime_types)) and not ('application/octet-stream' = any (allowed_mime_types))
   from storage.buckets where id = 'files'),
  'SVG와 octet-stream은 허용 형식이 아니다');

-- ─────────────────────────────────────────────
-- 사용자 A
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'files' and name like '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/%'$$,
  'A는 자기 워크스페이스 객체를 본다');
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'files' and name like '10000000-0000-0000-0000-0000000000fb/%'$$,
  'A는 B 워크스페이스 경로의 객체를 볼 수 없다');
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'files' and name like '%/x.pdf'$$,
  'A는 자기 워크스페이스 아래 B 프로젝트 경로의 객체를 볼 수 없다');
-- 삭제 정책은 직접 DELETE로 검증하지 않는다. storage-api의 protect_delete 트리거가
-- Storage API 밖의 직접 삭제를 막아 테스트 파일 전체가 중단될 수 있다.
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('files', '10000000-0000-0000-0000-0000000000fb/20000000-0000-0000-0000-0000000000fb/50000000-0000-0000-0000-0000000000f4/c.pdf')$$,
  '42501', null, 'A는 B 워크스페이스 경로에 업로드할 수 없다');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('files', '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/not-a-uuid/c.pdf')$$,
  '42501', null, 'files 행이 없는 경로에는 업로드할 수 없다');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('files', '10000000-0000-0000-0000-0000000000fa/20000000-0000-0000-0000-0000000000fa/50000000-0000-0000-0000-0000000000f5/d.pdf')$$,
  'A는 자기가 만든 pending 파일 경로에 업로드할 수 있다');

-- ─────────────────────────────────────────────
-- 사용자 B도 어긋난 경로의 객체를 볼 수 없다(files 행이 없다)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'files' and name like '%/x.pdf'$$,
  'B는 A 워크스페이스 세그먼트 아래 경로의 객체를 볼 수 없다');

reset role;
select * from finish();
rollback;
