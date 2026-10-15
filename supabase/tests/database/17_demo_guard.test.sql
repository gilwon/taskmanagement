-- 데모 계정 자격 변경·가입 차단, guest_shares_project private 이동, 프로젝트 리드 소속 검사(012)를 검증한다.
-- 한계. GoTrue가 supabase_auth_admin으로 보내는 UPDATE 분기는 이 세션에서 그 역할로 바꿀 수 없어 여기서 재현하지 않는다.
-- 그 분기는 로컬 스택에서 데모 토큰으로 PUT /auth/v1/user 비밀번호 변경이 500(forbidden)으로 막히는 것으로 확인한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ─────────────────────────────────────────────
-- 픽스처
-- d는 demo_seed 계정, o는 일반 owner, x는 어느 워크스페이스에도 없는 사람
-- W에 프로젝트 P가 있고 d의 이메일로 pending 초대가 있다
-- ─────────────────────────────────────────────
insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000017a1', 'demo@demoguard.test', 'hash-old',
   '{"provider":"email","providers":["email"],"demo_seed":true}'),
  ('00000000-0000-0000-0000-0000000017a2', 'owner@demoguard.test', 'hash-old', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-0000000017a3', 'outsider@demoguard.test', 'hash-old', '{"provider":"email"}');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000017b1', '데모 가드', 'demoguard-w', '00000000-0000-0000-0000-0000000017a2');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000017b1', '00000000-0000-0000-0000-0000000017a2', 'owner', 'active');

insert into public.projects (id, workspace_id, key, name) values
  ('20000000-0000-0000-0000-0000000017c1', '10000000-0000-0000-0000-0000000017b1', 'DG', '데모 가드');

insert into public.workspace_invites (id, workspace_id, email, role, invited_by) values
  ('30000000-0000-0000-0000-0000000017d1', '10000000-0000-0000-0000-0000000017b1', 'demo@demoguard.test',
   'member', '00000000-0000-0000-0000-0000000017a2');

-- ─────────────────────────────────────────────
-- auth.users 트리거. GoTrue(supabase_auth_admin) 경로는 postgres 세션에서 재현할 수 없어
-- 요청 JWT가 그 계정 자신인 경로로 가장한다(auth.uid() = old.id)
-- ─────────────────────────────────────────────
select has_trigger('auth', 'users', 'users_guard_demo', 'auth.users에 데모 계정 가드 트리거가 있다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}', true);
select throws_ok(
  $$update auth.users set encrypted_password = 'hash-new' where id = '00000000-0000-0000-0000-0000000017a1'$$,
  'P0001', 'forbidden', '데모 계정 자신은 비밀번호를 바꿀 수 없다');
select throws_ok(
  $$update auth.users set email = 'taken@demoguard.test' where id = '00000000-0000-0000-0000-0000000017a1'$$,
  'P0001', 'forbidden', '데모 계정 자신은 이메일을 바꿀 수 없다');
select lives_ok(
  $$update auth.users set last_sign_in_at = now(), updated_at = now() where id = '00000000-0000-0000-0000-0000000017a1'$$,
  '데모 계정의 로그인 컬럼 갱신은 허용된다');
select lives_ok(
  $$update auth.users set encrypted_password = 'hash-old', recovery_token = '' where id = '00000000-0000-0000-0000-0000000017a1'$$,
  '값이 그대로인 encrypted_password는 SET 목록에 있어도 허용된다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}', true);
select lives_ok(
  $$update auth.users set encrypted_password = 'hash-new' where id = '00000000-0000-0000-0000-0000000017a2'$$,
  '데모가 아닌 계정은 비밀번호를 바꿀 수 있다');

-- 시드 스크립트 경로(postgres, JWT 없음)
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$update auth.users set encrypted_password = 'hash-reseed', email = 'demo@demoguard.test'
    where id = '00000000-0000-0000-0000-0000000017a1'$$,
  'postgres 역할의 재시드는 데모 계정 비밀번호를 바꿀 수 있다');
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-0000000017a1'),
  'hash-reseed', '재시드 비밀번호가 저장된다');

-- ─────────────────────────────────────────────
-- 실행 권한
-- ─────────────────────────────────────────────
select ok(not has_function_privilege('authenticated', 'private.guard_demo_account()', 'execute')
          and not has_function_privilege('anon', 'private.guard_demo_account()', 'execute'),
  'authenticated·anon은 데모 가드 트리거 함수를 실행할 수 없다');
select ok(to_regprocedure('public.guest_shares_project(uuid, uuid)') is null,
  'public.guest_shares_project는 없다(RPC로 노출되지 않는다)');
select ok(not has_function_privilege('anon', 'private.guest_shares_project(uuid, uuid)', 'execute'),
  'anon은 private.guest_shares_project를 실행할 수 없다');

-- ─────────────────────────────────────────────
-- 프로젝트 리드 소속 검사
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}', true);
select throws_ok(
  $$update public.projects set lead_id = '00000000-0000-0000-0000-0000000017a3' where id = '20000000-0000-0000-0000-0000000017c1'$$,
  'P0001', 'invalid_assignee', '워크스페이스 구성원이 아닌 사람을 리드로 바꿀 수 없다');
select lives_ok(
  $$update public.projects set lead_id = '00000000-0000-0000-0000-0000000017a2' where id = '20000000-0000-0000-0000-0000000017c1'$$,
  '워크스페이스 구성원은 리드로 바꿀 수 있다');
select lives_ok(
  $$update public.projects set lead_id = null where id = '20000000-0000-0000-0000-0000000017c1'$$,
  '리드를 비울 수 있다');

-- ─────────────────────────────────────────────
-- 데모 계정 가입 차단(JWT app_metadata.demo_seed)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated","app_metadata":{"provider":"email","demo_seed":true}}', true);
select throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-0000000017d1')$$,
  'P0001', 'forbidden', '데모 계정은 초대를 수락할 수 없다');
select throws_ok(
  $$select * from public.create_workspace_onboarding('데모 새 곳', 'demoguard-new', null, null, '첫 프로젝트', 'blank')$$,
  'P0001', 'forbidden', '데모 계정은 워크스페이스를 만들 수 없다');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017a3","role":"authenticated","app_metadata":{"provider":"email"}}', true);
select lives_ok(
  $$select * from public.create_workspace_onboarding('외부 새 곳', 'demoguard-x', null, null, '첫 프로젝트', 'blank')$$,
  '데모가 아닌 계정은 온보딩할 수 있다');
reset role;

select * from finish();
rollback;
