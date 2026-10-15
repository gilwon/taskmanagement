-- files 행과 Storage 객체의 연결(리뷰 공격 E4·E5)과 업로드 상태 전이(finalize_file·fail_file·retry_file)를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ─────────────────────────────────────────────
-- 픽스처
-- 사용자 o owner, m member(PA edit), m2 member(PA edit), g guest(PA comment)
-- PA는 워크스페이스 공개, PB는 비공개
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e701', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000e702', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000e703', 'm2@example.test'),
  ('00000000-0000-0000-0000-00000000e704', 'g@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000e700', '워크스페이스', 'ws-e7', '00000000-0000-0000-0000-00000000e701');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000e700', '00000000-0000-0000-0000-00000000e701', 'owner'),
  ('10000000-0000-0000-0000-00000000e700', '00000000-0000-0000-0000-00000000e702', 'member'),
  ('10000000-0000-0000-0000-00000000e700', '00000000-0000-0000-0000-00000000e703', 'member'),
  ('10000000-0000-0000-0000-00000000e700', '00000000-0000-0000-0000-00000000e704', 'guest');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000e7a0', '10000000-0000-0000-0000-00000000e700', 'PA', 'A', 'workspace'),
  ('20000000-0000-0000-0000-00000000e7b0', '10000000-0000-0000-0000-00000000e700', 'PB', 'B', 'private');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-00000000e7a0', '00000000-0000-0000-0000-00000000e704', 'comment');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e702","role":"authenticated"}', true);

-- ─────────────────────────────────────────────
-- E4. files 행이 다른 프로젝트 경로를 가리키거나 ready로 직접 들어간다
-- ─────────────────────────────────────────────
select throws_ok(
  $$insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by)
    values ('50000000-0000-0000-0000-00000000e709', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
            'x.pdf', 'x.pdf', 'application/pdf', 1,
            '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7b0/50000000-0000-0000-0000-00000000e709/x.pdf',
            'ready', '00000000-0000-0000-0000-00000000e702')$$,
  '23514', null, 'storage_path는 행의 워크스페이스·프로젝트·id·이름과 같아야 한다');
select throws_ok(
  $$insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by)
    values ('50000000-0000-0000-0000-00000000e708', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
            '../x.pdf', 'x.pdf', 'application/pdf', 1,
            '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e708/x.pdf',
            'ready', '00000000-0000-0000-0000-00000000e702')$$,
  '23514', null, '파일명에 슬래시를 넣을 수 없다');
select throws_ok(
  $$insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path)
    values ('50000000-0000-0000-0000-00000000e707', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
            '기획서.pdf', '기획서.pdf', 'application/pdf', 1,
            '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e707/기획서.pdf')$$,
  '23514', null, 'Storage 객체 이름(object_name)은 ASCII만 쓴다');
with i as (
  insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path)
  values ('50000000-0000-0000-0000-00000000e706', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
          '기획서 최종.pdf', 'file.pdf', 'application/pdf', 1,
          '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e706/file.pdf')
  returning name
)
select is(name, '기획서 최종.pdf', '표시용 name은 한글을 쓸 수 있다') from i;

-- f1(크기 100)은 정상 흐름, f2는 객체 없음, f3은 크기 불일치
with i as (
  insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by)
  values
    ('50000000-0000-0000-0000-00000000e701', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
     'a.pdf', 'a.pdf', 'application/pdf', 100,
     '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e701/a.pdf',
     'ready', '00000000-0000-0000-0000-00000000e701'),
    ('50000000-0000-0000-0000-00000000e702', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
     'b.pdf', 'b.pdf', 'application/pdf', 100,
     '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e702/b.pdf',
     'pending', '00000000-0000-0000-0000-00000000e702'),
    ('50000000-0000-0000-0000-00000000e703', '10000000-0000-0000-0000-00000000e700', '20000000-0000-0000-0000-00000000e7a0',
     'c.pdf', 'c.pdf', 'application/pdf', 200,
     '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e703/c.pdf',
     'pending', '00000000-0000-0000-0000-00000000e702')
  returning status, uploaded_by
)
select ok(
  bool_and(status = 'pending' and uploaded_by = '00000000-0000-0000-0000-00000000e702'),
  '직접 insert는 status pending, uploaded_by 본인으로 강제된다') from i;

select throws_ok(
  $$update public.files set status = 'ready' where id = '50000000-0000-0000-0000-00000000e701'$$,
  '42501', null, 'status는 직접 바꿀 수 없다');

-- ─────────────────────────────────────────────
-- E5. files 행이 없는 경로·남의 pending 경로에 업로드한다
-- ─────────────────────────────────────────────
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('files', '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/99999999-0000-0000-0000-000000000000/orphan.pdf')$$,
  '42501', null, 'files 행이 없는 경로에는 업로드할 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e703","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    values ('files', '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e701/a.pdf',
            '{"size": 100}')$$,
  '42501', null, '다른 사람이 만든 pending 경로에는 업로드할 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e702","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, metadata) values
    ('files', '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e701/a.pdf',
     '{"size": 100}'),
    ('files', '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e703/c.pdf',
     '{"size": 100}')$$,
  '본인이 만든 pending 경로에는 업로드할 수 있다');

-- pending 객체는 볼 권한만 있는 게스트에게 열리지 않는다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e704","role":"authenticated"}', true);
select is_empty(
  $$select 1 from storage.objects where name like '%/50000000-0000-0000-0000-00000000e701/%'$$,
  '게스트는 pending 파일 객체를 볼 수 없다');
select throws_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000e701')$$,
  'P0001', 'forbidden', '편집 권한이 없으면 finalize_file을 할 수 없다');

-- ─────────────────────────────────────────────
-- 상태 전이
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e702","role":"authenticated"}', true);
select throws_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000e702')$$,
  'P0001', 'upload_incomplete', '객체가 없으면 ready가 되지 않는다');
select throws_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000e703')$$,
  'P0001', 'size_mismatch', '객체 크기가 다르면 ready가 되지 않는다');
select lives_ok(
  $$select public.finalize_file('50000000-0000-0000-0000-00000000e701')$$,
  '객체가 있고 크기가 같으면 finalize_file이 성공한다');
select is(
  (select status from public.files where id = '50000000-0000-0000-0000-00000000e701'),
  'ready'::public.file_status, 'finalize 후 ready다');
select is(
  (select count(*) from public.activities
   where project_id = '20000000-0000-0000-0000-00000000e7a0' and verb = 'added a file to'),
  1::bigint, 'ready가 되면 added a file to 활동이 남는다');

with u as (
  update storage.objects set metadata = '{"size": 1}'
  where name = '10000000-0000-0000-0000-00000000e700/20000000-0000-0000-0000-00000000e7a0/50000000-0000-0000-0000-00000000e701/a.pdf'
  returning 1
)
select is(count(*), 0::bigint, 'ready 파일 객체는 덮어쓸 수 없다') from u;

select lives_ok($$select public.fail_file('50000000-0000-0000-0000-00000000e702')$$, 'fail_file이 성공한다');
select is(
  (select status from public.files where id = '50000000-0000-0000-0000-00000000e702'),
  'failed'::public.file_status, 'fail_file 후 failed다');
select throws_ok(
  $$select public.fail_file('50000000-0000-0000-0000-00000000e701')$$,
  'P0001', 'invalid_state', 'ready 파일은 실패 처리할 수 없다');
select lives_ok($$select public.retry_file('50000000-0000-0000-0000-00000000e702')$$, 'retry_file이 failed를 pending으로 돌린다');

-- ready 객체는 게스트도 보고, 소프트 삭제되면 닫힌다
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e704","role":"authenticated"}', true);
select isnt_empty(
  $$select 1 from storage.objects where name like '%/50000000-0000-0000-0000-00000000e701/%'$$,
  '게스트는 ready 파일 객체를 본다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e702","role":"authenticated"}', true);
select ok(public.soft_delete_file('50000000-0000-0000-0000-00000000e701') is not null, '편집자가 파일을 소프트 삭제한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e704","role":"authenticated"}', true);
select is_empty(
  $$select 1 from storage.objects where name like '%/50000000-0000-0000-0000-00000000e701/%'$$,
  '소프트 삭제된 파일 객체는 게스트에게 닫힌다');

reset role;
select * from finish();
rollback;
