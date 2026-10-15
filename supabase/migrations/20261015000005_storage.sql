-- 비공개 Storage 버킷 files와 storage.objects 접근 정책을 만든다.
-- 객체 경로 규칙은 {workspace_id}/{project_id}/{file_id}/{object_name}이고 files.storage_path와 같아야 한다.
-- 경로를 직접 해석하지 않고 그 경로를 storage_path로 가진 files 행이 있는지로 판정한다
-- (판정 함수는 auth_helpers 마이그레이션의 can_*_file_object).

-- 허용 MIME. 서버(Server Action)가 확장자로 MIME을 정해 업로드하므로
-- 브라우저가 형식을 모를 때 보내는 application/octet-stream은 받지 않는다.
-- SVG는 스크립트를 담을 수 있어 이미지에서 제외한다.
-- application/x-figma는 .fig 파일에 서버가 붙이는 사용자 정의 형식이다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain',
    'application/json',
    'application/x-figma'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 조회(서명 URL 발급 포함). ready이고 삭제되지 않은 files 행이 있는 경로만 연다.
-- 편집 권한자는 정리(remove)를 위해 상태와 무관하게 연다.
create policy files_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.can_read_file_object(name));

-- 업로드. 같은 경로에 본인이 만든 pending files 행이 있을 때만
create policy files_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.can_upload_file_object(name));

create policy files_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'files' and public.can_upload_file_object(name))
  with check (bucket_id = 'files' and public.can_upload_file_object(name));

-- 삭제. 같은 경로의 files 행이 있고 편집 권한이 있을 때
create policy files_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.can_remove_file_object(name));

-- 이후 postgres가 public 스키마에 만드는 테이블·시퀀스·함수에 anon 권한이 자동으로 붙지 않게 한다.
-- 함수의 PUBLIC 기본 실행 권한은 전 스키마 설정이라 건드리지 않는다. 새 함수는 각 마이그레이션에서 public·anon 실행 권한을 직접 revoke한다.
-- 이 마이그레이션까지 만든 객체는 각 마이그레이션에서 이미 revoke했다.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
