-- 2단계 인증(TOTP)을 데이터 접근까지 강제한다.
-- 검증된 TOTP 요소가 있는 사용자는 JWT aal이 aal2가 아니면 PostgREST 요청 전체와 Storage 객체 접근을 거부한다.
-- 요소가 없는 사용자, 익명(데모) 세션, anon·service_role은 영향이 없다.
--
-- 롤백(원격에서도 이 한 줄이면 강제가 풀린다).
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
--
-- private 스키마에 두는 이유. public에 두면 노출 RPC 목록에 올라 /rpc/require_aal2 로 직접 호출된다.
-- private는 PostgREST가 노출하지 않는다. 다만 pre-request 함수는 PostgREST가 역할 전환 뒤 호출하므로
-- anon·authenticated가 스키마 usage와 함수 execute를 가져야 한다(아래 grant).

-- 현재 요청이 aal 조건을 만족하는지. 만족하지 못하면 false
-- 거짓이 되는 경우는 role=authenticated, aal=aal1, 검증된 본인 TOTP 요소가 있을 때뿐이다.
-- definer 사유. auth.mfa_factors는 클라이언트 역할이 읽을 수 없다.
create or replace function private.aal_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  -- aal1 인증 사용자가 아니면 auth.mfa_factors를 조회하지 않고 바로 통과시킨다
  if v_claims is null
     or v_claims ->> 'role' is distinct from 'authenticated'
     or v_claims ->> 'aal' is distinct from 'aal1'
     or coalesce(v_claims ->> 'is_anonymous', '') = 'true' then
    return true;
  end if;
  -- mfa_factors의 (user_id, created_at) 인덱스를 탄다
  return not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (v_claims ->> 'sub')::uuid and f.status = 'verified'
  );
end;
$$;

-- PostgREST db_pre_request 훅. 모든 요청 앞에서 불리고 조건을 못 채우면 403(42501) mfa_required로 끊는다
create or replace function private.require_aal2()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.aal_ok() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.aal_ok() from public;
revoke execute on function private.require_aal2() from public;
grant execute on function private.aal_ok() to authenticated;
grant execute on function private.require_aal2() to anon, authenticated, service_role, authenticator;
-- pre-request 함수 해석과 실행에 필요하다. service_role 요청에도 훅이 불리므로 빠지면 서비스 키 호출이 막힌다. private의 다른 함수는 각자 revoke·grant로 막혀 있다
grant usage on schema private to anon, service_role, authenticator;

alter role authenticator set pgrst.db_pre_request = 'private.require_aal2';
notify pgrst, 'reload config';

-- Storage는 PostgREST를 거치지 않으므로 객체 정책에 같은 조건을 더한다.
-- restrictive 정책은 기존 permissive 정책(files_objects_*)과 AND로 합쳐져 기존 구조를 바꾸지 않는다.
create policy require_aal2_objects on storage.objects
  as restrictive for all to authenticated
  using (private.aal_ok())
  with check (private.aal_ok());
