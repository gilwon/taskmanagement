-- 조직 마이그레이션(008)의 초대 거절·중복 초대 방지·초대됨 상태 보호·워크스페이스 삭제·알림 설정 반영을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, a admin, m member, i invited 구성원, x 비구성원(초대 받음)
-- W1 파일 객체가 있는 워크스페이스, W2 빈 워크스페이스(o owner)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000013a1', 'owner@org.test'),
  ('00000000-0000-0000-0000-0000000013a2', 'admin@org.test'),
  ('00000000-0000-0000-0000-0000000013a3', 'member@org.test'),
  ('00000000-0000-0000-0000-0000000013a4', 'invited@org.test'),
  ('00000000-0000-0000-0000-0000000013a5', 'Outsider@org.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000013b1', '조직', 'org-w1', '00000000-0000-0000-0000-0000000013a1'),
  ('10000000-0000-0000-0000-0000000013b2', '빈 조직', 'org-w2', '00000000-0000-0000-0000-0000000013a1');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000013a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000013a2', 'admin', 'active'),
  ('10000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000013a3', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-0000000013a4', 'member', 'invited'),
  ('10000000-0000-0000-0000-0000000013b2', '00000000-0000-0000-0000-0000000013a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000013b2', '00000000-0000-0000-0000-0000000013a2', 'admin', 'active');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-0000000013c1', '10000000-0000-0000-0000-0000000013b1', 'ORG', '프로젝트', 'workspace'),
  ('20000000-0000-0000-0000-0000000013c2', '10000000-0000-0000-0000-0000000013b2', 'EMP', '빈 프로젝트', 'workspace');

insert into public.workspace_invites (id, workspace_id, email, role, invited_by) values
  ('30000000-0000-0000-0000-0000000013d1', '10000000-0000-0000-0000-0000000013b1', 'outsider@org.test', 'member', '00000000-0000-0000-0000-0000000013a1'),
  ('30000000-0000-0000-0000-0000000013d2', '10000000-0000-0000-0000-0000000013b1', 'invited@org.test', 'member', '00000000-0000-0000-0000-0000000013a1');

-- W1에만 Storage 객체(경로 규칙 {ws}/{project}/{file}/{name})
insert into storage.objects (bucket_id, name, metadata) values
  ('files', '10000000-0000-0000-0000-0000000013b1/20000000-0000-0000-0000-0000000013c1/40000000-0000-0000-0000-0000000013e1/a.pdf',
   '{"size": 1}');

set local role authenticated;

-- ─────────────────────────────────────────────
-- 초대 거절
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a3","role":"authenticated"}', true);
select throws_ok(
  $$select public.decline_invite('30000000-0000-0000-0000-0000000013d1')$$,
  'P0001', 'not_found', '남의 초대는 거절할 수 없다(not_found)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a5","role":"authenticated"}', true);
select is((select count(*) from public.my_invites()), 1::bigint, '초대받은 사람은 대소문자와 무관하게 자기 초대를 본다');
select lives_ok($$select public.decline_invite('30000000-0000-0000-0000-0000000013d1')$$, '자기 초대는 거절할 수 있다');
select is((select count(*) from public.my_invites()), 0::bigint, '거절한 초대는 목록에서 사라진다');
select throws_ok(
  $$select public.decline_invite('30000000-0000-0000-0000-0000000013d1')$$,
  'P0001', 'not_found', '처리된 초대는 다시 거절할 수 없다');
select throws_ok(
  $$select public.accept_invite('30000000-0000-0000-0000-0000000013d1')$$,
  'P0001', 'not_found', '거절한 초대는 수락할 수 없다');

-- ─────────────────────────────────────────────
-- 중복 초대 방지
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a2","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.workspace_invites (workspace_id, email, role, invited_by)
    values ('10000000-0000-0000-0000-0000000013b1', 'outsider@org.test', 'member', '00000000-0000-0000-0000-0000000013a2')$$,
  '거절된 초대가 있어도 다시 초대할 수 있다');
select throws_ok(
  $$insert into public.workspace_invites (workspace_id, email, role, invited_by)
    values ('10000000-0000-0000-0000-0000000013b1', 'OUTSIDER@org.test', 'guest', '00000000-0000-0000-0000-0000000013a2')$$,
  '23505', null, '같은 이메일의 pending 초대는 하나만 둘 수 있다(대소문자 무시)');

-- ─────────────────────────────────────────────
-- 초대됨 상태 보호와 비활성화·재활성화
-- ─────────────────────────────────────────────
select throws_ok(
  $$update public.workspace_members set status = 'active'
    where workspace_id = '10000000-0000-0000-0000-0000000013b1' and user_id = '00000000-0000-0000-0000-0000000013a4'$$,
  'P0001', 'forbidden', '관리자는 초대됨 구성원을 직접 active로 바꿀 수 없다');
select throws_ok(
  $$update public.workspace_members set status = 'invited'
    where workspace_id = '10000000-0000-0000-0000-0000000013b1' and user_id = '00000000-0000-0000-0000-0000000013a3'$$,
  'P0001', 'forbidden', '관리자는 구성원을 초대됨으로 되돌릴 수 없다');
select lives_ok(
  $$update public.workspace_members set status = 'deactivated'
    where workspace_id = '10000000-0000-0000-0000-0000000013b1' and user_id = '00000000-0000-0000-0000-0000000013a3'$$,
  '관리자는 구성원을 비활성화할 수 있다');
select lives_ok(
  $$update public.workspace_members set status = 'active'
    where workspace_id = '10000000-0000-0000-0000-0000000013b1' and user_id = '00000000-0000-0000-0000-0000000013a3'$$,
  '관리자는 비활성 구성원을 재활성화할 수 있다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a4","role":"authenticated"}', true);
select is(
  (public.accept_invite('30000000-0000-0000-0000-0000000013d2')).status, 'active'::public.member_status,
  '초대됨 구성원은 초대 수락으로 active가 된다');

-- ─────────────────────────────────────────────
-- 앱 내 알림 설정
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a3","role":"authenticated"}', true);
insert into public.user_prefs (user_id, workspace_id, notif_prefs)
  values ('00000000-0000-0000-0000-0000000013a3', '10000000-0000-0000-0000-0000000013b1', '{"assign": false}');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a1","role":"authenticated"}', true);
insert into public.tasks (project_id, title, assignee_id, sort_order)
  values ('20000000-0000-0000-0000-0000000013c1', '끈 알림', '00000000-0000-0000-0000-0000000013a3', 1);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a3","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'assign'), 0::bigint,
  '담당자 지정 알림을 끈 사람에게는 그 알림이 생기지 않는다');
update public.user_prefs set notif_prefs = '{"assign": true}'
  where user_id = '00000000-0000-0000-0000-0000000013a3' and workspace_id = '10000000-0000-0000-0000-0000000013b1';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a1","role":"authenticated"}', true);
insert into public.tasks (project_id, title, assignee_id, sort_order)
  values ('20000000-0000-0000-0000-0000000013c1', '켠 알림', '00000000-0000-0000-0000-0000000013a3', 2);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a3","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'assign'), 1::bigint,
  '알림을 다시 켜면 담당자 지정 알림이 생긴다');

-- ─────────────────────────────────────────────
-- 워크스페이스 삭제
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a5","role":"authenticated"}', true);
select throws_ok(
  $$select public.delete_workspace('10000000-0000-0000-0000-0000000013b2', 'org-w2')$$,
  'P0001', 'not_found', '비구성원은 워크스페이스를 지울 수 없다(not_found)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a2","role":"authenticated"}', true);
select throws_ok(
  $$select public.delete_workspace('10000000-0000-0000-0000-0000000013b2', 'org-w2')$$,
  'P0001', 'forbidden', 'admin은 워크스페이스를 지울 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000013a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.delete_workspace('10000000-0000-0000-0000-0000000013b2', '빈 조직')$$,
  'P0001', 'confirm_mismatch', '확인 입력이 URL과 다르면 지울 수 없다');
select throws_ok(
  $$select public.delete_workspace('10000000-0000-0000-0000-0000000013b1', 'org-w1')$$,
  'P0001', 'files_remain', 'Storage 객체가 남은 워크스페이스는 지울 수 없다');
select lives_ok(
  $$select public.delete_workspace('10000000-0000-0000-0000-0000000013b2', 'org-w2')$$,
  'owner는 객체가 없는 워크스페이스를 지울 수 있다');

reset role;
select is((select count(*) from public.workspaces where id = '10000000-0000-0000-0000-0000000013b2'), 0::bigint,
  '삭제한 워크스페이스 행이 사라진다');
select is((select count(*) from public.projects where workspace_id = '10000000-0000-0000-0000-0000000013b2'), 0::bigint,
  '하위 프로젝트도 함께 사라진다');
select is((select count(*) from public.workspaces where id = '10000000-0000-0000-0000-0000000013b1'), 1::bigint,
  '거부된 워크스페이스는 남아 있다');

select * from finish();
rollback;
