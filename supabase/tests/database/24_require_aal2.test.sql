-- 마이그레이션 25의 private.require_aal2()·private.aal_ok() 판정을 JWT 클레임 흉내로 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- 픽스처. a 검증된 TOTP 요소, b 요소 없음, c 미검증 요소만, d 익명 사용자(요소 있어도 통과해야 함)
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000024a1', 'verified@aal.test', false),
  ('00000000-0000-0000-0000-0000000024a2', 'none@aal.test', false),
  ('00000000-0000-0000-0000-0000000024a3', 'unverified@aal.test', false),
  ('00000000-0000-0000-0000-0000000024a4', null, true);
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('50000000-0000-0000-0000-0000000024f1', '00000000-0000-0000-0000-0000000024a1', 'v', 'totp', 'verified', now(), now()),
  ('50000000-0000-0000-0000-0000000024f3', '00000000-0000-0000-0000-0000000024a3', 'u', 'totp', 'unverified', now(), now()),
  ('50000000-0000-0000-0000-0000000024f4', '00000000-0000-0000-0000-0000000024a4', 'a', 'totp', 'verified', now(), now());

set local role authenticated;

-- aal1 + 검증된 요소 → 거부
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated","aal":"aal1"}', true);
select throws_ok('select private.require_aal2()', '42501', 'mfa_required', 'aal1이고 검증된 요소가 있으면 mfa_required');
select is(private.aal_ok(), false, 'aal_ok도 false');

-- aal2 → 통과
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated","aal":"aal2"}', true);
select lives_ok('select private.require_aal2()', 'aal2는 통과');
select is(private.aal_ok(), true, 'aal_ok도 true');

-- aal1 + 요소 없음 → 통과
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a2","role":"authenticated","aal":"aal1"}', true);
select lives_ok('select private.require_aal2()', '요소가 없으면 aal1도 통과');

-- aal1 + 미검증 요소만 → 통과
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a3","role":"authenticated","aal":"aal1"}', true);
select lives_ok('select private.require_aal2()', '미검증 요소만 있으면 통과');

-- 익명 세션 → 통과
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a4","role":"authenticated","aal":"aal1","is_anonymous":true}', true);
select lives_ok('select private.require_aal2()', '익명 세션은 통과');

-- 클레임이 없으면 통과(SQL 직접 접속 등)
select set_config('request.jwt.claims', '', true);
select is(private.aal_ok(), true, '클레임이 없으면 통과');

-- anon (PostgREST가 역할 전환 뒤 호출하므로 anon도 실행할 수 있어야 한다)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok('select private.require_aal2()', 'anon은 통과');

-- service_role
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok('select private.require_aal2()', 'service_role은 통과');

-- Storage 정책: aal1+요소 있음은 objects를 읽을 수 없다(restrictive 정책이 모든 행을 막는 것이 아니라 오류 없이 0건)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from storage.objects), 0::bigint, 'aal1+요소 있음은 storage.objects가 0건');

-- 훅 설정이 걸려 있다
reset role;
select ok(
  exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
          where r.rolname = 'authenticator' and 'pgrst.db_pre_request=private.require_aal2' = any (s.setconfig)),
  'authenticator에 db_pre_request가 걸려 있다');

select * from finish();
rollback;
