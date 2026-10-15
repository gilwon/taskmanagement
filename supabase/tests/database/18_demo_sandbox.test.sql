-- 방문자별 데모 사본(013·014)을 검증한다. 사본 생성·재사용·격리·상한·만료 정리와 익명 사용자 가드를 본다.
-- 한계. GoTrue가 supabase_auth_admin으로 보내는 UPDATE 분기는 이 세션에서 재현하지 않는다.
-- 그 분기는 로컬 스택에서 익명 토큰으로 PUT /auth/v1/user 이메일 변경이 막히는 것으로 확인한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ─────────────────────────────────────────────
-- 픽스처
-- a·b는 익명 사용자, r은 일반 사용자, o는 일반 워크스페이스 owner. 일반 워크스페이스에 pending 초대가 하나 있다.
-- 공유 구성원 생성 경로를 보려고 기존 demo_seed 계정을 지운다(롤백된다)
-- ─────────────────────────────────────────────
delete from public.workspaces w where exists (
  select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = w.id and u.raw_app_meta_data ->> 'demo_seed' = 'true');
delete from auth.users where raw_app_meta_data ->> 'demo_seed' = 'true';

insert into auth.users (id, email, encrypted_password, is_anonymous, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000018a1', null, '', true, '{}', '{"name":"데모 사용자"}'),
  ('00000000-0000-0000-0000-0000000018a2', null, '', true, '{}', '{"name":"데모 사용자"}'),
  ('00000000-0000-0000-0000-0000000018a3', 'real@sandbox.test', 'hash', false, '{"provider":"email"}', '{}'),
  ('00000000-0000-0000-0000-0000000018a4', 'owner@sandbox.test', 'hash', false, '{"provider":"email"}', '{}');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000018b1', '일반', 'sandbox-real', '00000000-0000-0000-0000-0000000018a4');
insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000018b1', '00000000-0000-0000-0000-0000000018a4', 'owner', 'active');
insert into public.workspace_invites (id, workspace_id, email, role, invited_by) values
  ('30000000-0000-0000-0000-0000000018d1', '10000000-0000-0000-0000-0000000018b1', 'anyone@sandbox.test',
   'member', '00000000-0000-0000-0000-0000000018a4');

create temp table t_slug (who text primary key, slug text);
grant all on t_slug to authenticated;

-- ─────────────────────────────────────────────
-- 권한
-- ─────────────────────────────────────────────
select ok(not has_function_privilege('anon', 'public.start_demo_sandbox()', 'execute'),
  'anon은 start_demo_sandbox를 실행할 수 없다');
select ok(not has_function_privilege('authenticated', 'private.seed_demo_workspace(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'private.purge_demo_sandboxes()', 'execute'),
  'authenticated는 시드·정리 함수를 실행할 수 없다');
select ok(to_regprocedure('private.ensure_demo_members()') is not null
          and not has_function_privilege('authenticated', 'private.ensure_demo_members()', 'execute'),
  'ensure_demo_members가 있고 authenticated는 실행할 수 없다');
select is((select count(*)::int from cron.job where jobname = 'purge-demo-sandboxes' and schedule = '17 * * * *'), 1,
  '매시간 정리 작업이 예약되어 있다');

-- 데모가 아닌 계정이 공유 구성원 이메일을 쓰고 있으면 그 계정을 쓰지 않고 멈춘다
insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000018a6', 'hana.song@demo.example.com', 'hash', '{"provider":"email"}');
select throws_ok($$select private.ensure_demo_members()$$, 'P0001', 'demo_member_conflict',
  '데모가 아닌 계정이 공유 이메일을 쓰면 demo_member_conflict로 거부한다');
delete from auth.users where id = '00000000-0000-0000-0000-0000000018a6';

-- ─────────────────────────────────────────────
-- 사본 생성
-- ─────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a3","role":"authenticated","is_anonymous":false}', true);
select throws_ok($$select public.start_demo_sandbox()$$, 'P0001', 'forbidden', '익명이 아닌 사용자는 사본을 만들 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated","is_anonymous":true}', true);
insert into t_slug values ('a', public.start_demo_sandbox());
select ok((select slug ~ '^demo-[a-z0-9]{8}$' from t_slug where who = 'a'), '사본 slug는 demo- + 8자다');
select is(current_setting('request.jwt.claims', true),
  '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated","is_anonymous":true}',
  '사본을 만든 뒤 JWT claims가 되돌아온다');
select is(public.start_demo_sandbox(), (select slug from t_slug where who = 'a'), '다시 부르면 같은 사본 slug를 돌려준다');
select is((select count(*)::int from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000018a1'), 1,
  '다시 불러도 사본이 하나다');
select is((select role::text from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
           where m.user_id = '00000000-0000-0000-0000-0000000018a1'), 'admin', '호출자는 사본의 admin이다');

reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.tasks t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 27, '사본에 작업 27개가 있다');
select is((select count(*)::int from public.projects t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 3, '사본에 프로젝트 3개가 있다');
select is((select count(*)::int from public.workspace_members t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 6, '사본에 구성원 6명이 있다');
select is((select count(*)::int from public.activities t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 6, '활동은 시드가 넣은 6개뿐이다(트리거 기록 없음)');
select is((select count(*)::int from public.notifications t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 6, '알림은 시드가 넣은 6개뿐이다');
select ok((select demo_expires_at between now() + interval '23 hours' and now() + interval '25 hours'
           from public.workspaces w join t_slug s on s.slug = w.slug and s.who = 'a'), '사본은 24시간 뒤 만료된다');
select is((select count(*)::int from auth.users where raw_app_meta_data ->> 'demo_seed' = 'true'
           and banned_until > now() + interval '100 years'), 5, '없던 공유 구성원 5명을 로그인 금지로 만든다');
select is((select created_by from public.workspaces w join t_slug s on s.slug = w.slug and s.who = 'a'),
  '00000000-0000-0000-0000-0000000018a1'::uuid, '사본의 created_by는 호출자다');
select ok((select (m ->> 'hana.song')::uuid = (select id from auth.users where email = 'hana.song@demo.example.com')
                  and (select count(*) from auth.users where raw_app_meta_data ->> 'demo_seed' = 'true') = 5
           from private.ensure_demo_members() m),
  'ensure_demo_members는 이미 있는 공유 구성원을 다시 쓴다');

-- 사본 admin이 자기 구성원 행을 지우고 다시 불러도 새 사본을 만들지 않는다(상한 고갈 방지)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated","is_anonymous":true}', true);
delete from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000018a1';
select is(public.start_demo_sandbox(), (select slug from t_slug where who = 'a'),
  '자기 구성원 행을 지운 뒤 다시 불러도 같은 slug를 돌려준다');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.workspaces where created_by = '00000000-0000-0000-0000-0000000018a1'), 1,
  '구성원 행을 지운 뒤에도 a의 사본은 하나다');
select is((select count(*)::int from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000018a1'), 0,
  '지운 구성원 행은 실제로 지워졌고 재호출로 되살아나지 않는다');

-- 두 번째 익명 사용자는 공유 구성원을 다시 만들지 않고 자기 사본을 받는다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated","is_anonymous":true}', true);
insert into t_slug values ('b', public.start_demo_sandbox());
select isnt((select slug from t_slug where who = 'b'), (select slug from t_slug where who = 'a'), '익명 사용자마다 다른 사본을 받는다');

-- ─────────────────────────────────────────────
-- 격리(RLS). b는 a의 사본과 일반 워크스페이스를 볼 수 없다
-- ─────────────────────────────────────────────
select is((select count(*)::int from public.tasks t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'a'), 0, '다른 사본의 작업은 0행이다');
select is((select count(*)::int from public.tasks t join public.workspaces w on w.id = t.workspace_id
           join t_slug s on s.slug = w.slug and s.who = 'b'), 27, '자기 사본의 작업 27개는 보인다');
select is((select count(*)::int from public.workspaces where id = '10000000-0000-0000-0000-0000000018b1'), 0,
  '일반 워크스페이스는 보이지 않는다');

-- ─────────────────────────────────────────────
-- 익명 사용자 가드
-- ─────────────────────────────────────────────
select throws_ok(
  $$select * from public.create_workspace_onboarding('익명 새 곳', 'sandbox-anon', null, null, '첫 프로젝트', 'blank')$$,
  'P0001', 'forbidden', '익명 사용자는 온보딩으로 워크스페이스를 만들 수 없다');
select throws_ok($$select public.accept_invite('30000000-0000-0000-0000-0000000018d1')$$,
  'P0001', 'forbidden', '익명 사용자는 초대를 수락할 수 없다');
select throws_ok(
  $$insert into public.workspace_invites (workspace_id, email, role, invited_by)
    select w.id, 'friend@sandbox.test', 'member', '00000000-0000-0000-0000-0000000018a2'
    from public.workspaces w join t_slug s on s.slug = w.slug and s.who = 'b'$$,
  '42501', null, '사본 admin도 사본에 초대를 넣을 수 없다');

-- auth.users는 authenticated에 권한이 없어 postgres 세션에서 요청 JWT가 그 계정 자신인 경로로 가장한다(17과 같다)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  $$update auth.users set email = 'take@sandbox.test' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'P0001', 'forbidden', '익명 사용자 자신은 이메일을 설정할 수 없다');
select throws_ok(
  $$update auth.users set is_anonymous = false where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'P0001', 'forbidden', '익명 사용자 자신은 실제 계정으로 바뀔 수 없다');
select throws_ok(
  $$update auth.users set email_change = 'take@sandbox.test' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'P0001', 'forbidden', '익명 사용자 자신은 이메일 변경을 요청할 수 없다');
select throws_ok(
  $$update auth.users set phone = '821012345678' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'P0001', 'forbidden', '익명 사용자 자신은 전화번호를 설정할 수 없다');
select lives_ok(
  $$update auth.users set last_sign_in_at = now(), encrypted_password = '' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  '익명 사용자의 로그인 컬럼 갱신은 허용된다');
select set_config('request.jwt.claims', '', true);

-- 파일 업로드. b가 자기 사본에 pending 행을 만든 상황에서 Storage 객체 insert는 익명 JWT일 때만 거부된다
insert into public.files (id, workspace_id, project_id, name, object_name, type, mime, size_bytes, storage_path, status, uploaded_by)
select '50000000-0000-0000-0000-0000000018f1', pr.workspace_id, pr.id, 'a.pdf', 'a.pdf', 'pdf', 'application/pdf', 10,
       pr.workspace_id || '/' || pr.id || '/50000000-0000-0000-0000-0000000018f1/a.pdf', 'pending', '00000000-0000-0000-0000-0000000018a2'
from public.projects pr join public.workspaces w on w.id = pr.workspace_id join t_slug s on s.slug = w.slug and s.who = 'b'
where pr.key = 'APP';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated","is_anonymous":true}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) select 'files', storage_path from public.files where id = '50000000-0000-0000-0000-0000000018f1'$$,
  '42501', null, '익명 사용자는 파일을 올릴 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated","is_anonymous":false}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) select 'files', storage_path from public.files where id = '50000000-0000-0000-0000-0000000018f1'$$,
  '같은 행·경로라도 익명이 아니면 올릴 수 있다(나머지 정책 조건은 그대로다)');
reset role;
select set_config('request.jwt.claims', '', true);

-- ─────────────────────────────────────────────
-- 상한과 만료 정리
-- ─────────────────────────────────────────────
-- 살아 있는 사본을 500개까지 채운다
insert into public.workspaces (name, slug, demo_expires_at)
select '상한', 'demo-cap-' || g, now() + interval '1 hour'
from generate_series(1, greatest(0, 500 - (select count(*)::int from public.workspaces where demo_expires_at > now()))) g;
insert into auth.users (id, is_anonymous, raw_app_meta_data) values ('00000000-0000-0000-0000-0000000018a5', true, '{}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a5","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$select public.start_demo_sandbox()$$, 'P0001', 'demo_full', '살아 있는 사본이 500개면 demo_full로 거부한다');
reset role;
select set_config('request.jwt.claims', '', true);

-- a의 사본과 a 계정을 만료시키고 정리한다. b와 공유 구성원, 일반 워크스페이스는 남는다
update public.workspaces w set demo_expires_at = now() - interval '1 minute'
from t_slug s where s.slug = w.slug and s.who = 'a';
update auth.users set created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000018a1';
select private.purge_demo_sandboxes();
select ok(
  not exists (select 1 from public.workspaces w join t_slug s on s.slug = w.slug and s.who = 'a')
  and not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000018a1')
  and exists (select 1 from public.workspaces w join t_slug s on s.slug = w.slug and s.who = 'b')
  and exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000018a2')
  and exists (select 1 from public.workspaces where id = '10000000-0000-0000-0000-0000000018b1')
  and (select count(*) from auth.users where raw_app_meta_data ->> 'demo_seed' = 'true') = 5,
  '정리는 만료된 사본과 24시간 지난 익명 사용자만 지운다');

select * from finish();
rollback;
