-- finalize_file이 Storage 객체의 MIME(metadata.mimetype)이 files.mime과 같은지도 확인하게 바꾼다.
-- 서버가 확장자로 정한 MIME과 다른 content-type으로 올리는 위장(예 .pdf 행에 text/plain 본문)을 ready 전에 막는다.
--
-- 새 오류 코드(errcode 'P0001', rpc 마이그레이션의 오류 규약에 더한다).
--   mime_mismatch  올라간 객체의 MIME이 files.mime과 다르다
-- 예외를 던지면 같은 트랜잭션의 status 변경도 되돌려지므로 행은 pending으로 남는다.
-- upload_incomplete·size_mismatch와 같게 앱이 오류를 받은 뒤 fail_file로 failed로 돌린다.
-- metadata에 mimetype이 없는 객체는 비교하지 않는다. Storage API는 업로드마다 mimetype을 기록하고,
-- 없는 경우는 SQL로 직접 넣은 객체(pgTAP 07_file_flow 픽스처)뿐이다.

-- Storage 객체가 실제로 있고 metadata.size가 size_bytes와, metadata.mimetype이 mime과 같을 때만 ready로 바꾼다.
-- 이미 ready면 그대로 돌려준다.
-- definer 사유. files의 클라이언트 수정 권한에는 status가 없다. finalize_file은 클라이언트가 볼 수 없는
-- pending 객체의 metadata도 읽어야 한다. 함수 안에서 auth.uid()와 편집 권한, 프로젝트 삭제 상태를 직접 확인한다.
create or replace function public.finalize_file(p_file uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.files;
  v_size bigint;
  v_mime text;
begin
  perform private.require_uid();
  v_f := private.require_file_edit(p_file);
  if v_f.status = 'ready' then
    return v_f;
  end if;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_size, v_mime
  from storage.objects o
  where o.bucket_id = 'files' and o.name = v_f.storage_path;
  if not found then
    raise exception using errcode = 'P0001', message = 'upload_incomplete';
  end if;
  if v_size is distinct from v_f.size_bytes then
    raise exception using errcode = 'P0001', message = 'size_mismatch';
  end if;
  if v_mime is not null and v_mime <> v_f.mime then
    raise exception using errcode = 'P0001', message = 'mime_mismatch';
  end if;
  update public.files f set status = 'ready' where f.id = p_file returning * into v_f;
  return v_f;
end;
$$;

revoke execute on function public.finalize_file(uuid) from public, anon;
grant execute on function public.finalize_file(uuid) to authenticated;
