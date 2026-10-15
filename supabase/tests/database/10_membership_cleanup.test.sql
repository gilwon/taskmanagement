-- 초대·구성원 정리(제거 후 재가입 차단, invited 활성화), 관리자 삭제 댓글 복원 제한, 프로젝트 영구 삭제 전 객체 정리를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, m member, w member(active), x·y·z invited 상태 구성원
-- x·y·z에게는 pending 초대가 있다(invited 행은 초대를 받을 수 있다)
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ea01', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000ea02', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000ea03', 'W@Example.test'),
  ('00000000-0000-0000-0000-00000000ea04', 'x@example.test'),
  ('00000000-0000-0000-0000-00000000ea05', 'y@example.test'),
  ('00000000-0000-0000-0000-00000000ea06', 'z@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000ea00', '워크스페이스', 'ws-ea', '00000000-0000-0000-0000-00000000ea01');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea01', 'owner', 'active'),
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea02', 'member', 'active'),
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea03', 'member', 'active'),
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea04', 'member', 'invited'),
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea05', 'guest', 'invited'),
  ('10000000-0000-0000-0000-00000000ea00', '00000000-0000-0000-0000-00000000ea06', 'member', 'invited');

insert into public.workspace_invites (id, workspace_id, email, role, invited_by) values
  ('90000000-0000-0000-0000-00000000ea04', '10000000-0000-0000-0000-00000000ea00', 'x@example.test', 'member', '00000000-0000-0000-0000-00000000ea01'),
  ('90000000-0000-0000-0000-00000000ea05', '10000000-0000-0000-0000-00000000ea00', 'Y@example.test', 'member', '00000000-0000-0000-0000-00000000ea01'),
  ('90000000-0000-0000-0000-00000000ea06', '10000000-0000-0000-0000-00000000ea00', 'z@example.test', 'member', '00000000-0000-0000-0000-00000000ea01');

-- PL은 살아 있는 프로젝트, PR은 보관만 된 프로젝트
insert into public.projects (id, workspace_id, key, name, access, archived_at) values
  ('20000000-0000-0000-0000-00000000eaa0', '10000000-0000-0000-0000-00000000ea00', 'PL', 'L', 'workspace', null),
  ('20000000-0000-0000-0000-00000000eab0', '10000000-0000-0000-0000-00000000ea00', 'PR', 'R', 'workspace', now());

insert into public.tasks (id, workspace_id, project_id, key, title, sort_order) values
  ('30000000-0000-0000-0000-00000000eaa1', '10000000-0000-0000-0000-00000000ea00', '20000000-0000-0000-0000-00000000eaa0', 'PL-101', 't', 1);

insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-00000000ea01', '30000000-0000-0000-0000-00000000eaa1', '00000000-0000-0000-0000-00000000ea02', '관리자가 지울 글'),
  ('40000000-0000-0000-0000-00000000ea02', '30000000-0000-0000-0000-00000000eaa1', '00000000-0000-0000-0000-00000000ea02', '내가 지울 글');

insert into public.files (id, workspace_id, project_id, name, object_name, mime, size_bytes, storage_path, status, uploaded_by) values
  ('50000000-0000-0000-0000-00000000eab1', '10000000-0000-0000-0000-00000000ea00', '20000000-0000-0000-0000-00000000eab0',
   '보관 문서.pdf', 'r.pdf', 'application/pdf', 1,
   '10000000-0000-0000-0000-00000000ea00/20000000-0000-0000-0000-00000000eab0/50000000-0000-0000-0000-00000000eab1/r.pdf',
   'ready', '00000000-0000-0000-0000-00000000ea02');

set local role authenticated;

-- ─────────────────────────────────────────────
-- 1. 제거된 구성원은 남은 초대로 돌아오지 못한다. 구성원 이메일로는 초대를 만들 수 없다.
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
delete from public.workspace_members
where workspace_id = '10000000-0000-0000-0000-00000000ea00' and user_id = '00000000-0000-0000-0000-00000000ea04';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea04","role":"authenticated"}', true);
select throws_ok($$select public.accept_invite('90000000-0000-0000-0000-00000000ea04')$$,
  'P0001', 'not_found', '제거된 구성원은 남아 있던 초대로 다시 들어올 수 없다');
reset role;
select is((select status from public.workspace_invites where id = '90000000-0000-0000-0000-00000000ea04'), 'revoked',
  '구성원 행을 지우면 그 이메일의 pending 초대가 revoked가 된다');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.workspace_invites (workspace_id, email, role, invited_by)
    values ('10000000-0000-0000-0000-00000000ea00', 'w@example.TEST', 'admin', '00000000-0000-0000-0000-00000000ea01')$$,
  'P0001', 'already_member', 'active 구성원 이메일로는 초대를 만들 수 없다(대소문자 무시)');
select lives_ok(
  $$update public.workspace_invites set status = 'pending' where id = '90000000-0000-0000-0000-00000000ea04'$$,
  '구성원이 아닌(제거된) 사람의 초대는 관리자가 다시 열 수 있다');

-- ─────────────────────────────────────────────
-- 5. invited 상태 구성원의 수락은 active로, deactivated는 그대로
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea05","role":"authenticated"}', true);
select is(
  (select role::text || '|' || status::text from public.accept_invite('90000000-0000-0000-0000-00000000ea05')),
  'member|active', 'invited 구성원이 수락하면 초대 역할의 active가 된다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
select throws_ok(
  $$update public.workspace_invites set status = 'pending' where id = '90000000-0000-0000-0000-00000000ea05'$$,
  'P0001', 'already_member', '수락된 초대를 다시 pending으로 돌리는 것도 같은 규칙을 따른다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
update public.workspace_members set status = 'deactivated'
where workspace_id = '10000000-0000-0000-0000-00000000ea00' and user_id = '00000000-0000-0000-0000-00000000ea06';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea06","role":"authenticated"}', true);
select is(
  (select status::text from public.accept_invite('90000000-0000-0000-0000-00000000ea06')),
  'deactivated', '비활성화된 구성원은 남은 초대를 수락해도 비활성 상태 그대로다');
reset role;
select is((select status from public.workspace_invites where id = '90000000-0000-0000-0000-00000000ea06'), 'accepted',
  '비활성 구성원의 초대는 accepted로만 처리된다');
set local role authenticated;

-- ─────────────────────────────────────────────
-- 2. 관리자가 지운 댓글은 작성자가 되살리지 못한다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
select isnt(set_config('test.tok1', public.soft_delete_comment('40000000-0000-0000-0000-00000000ea01')::text, true),
  null, '관리자가 남의 댓글을 소프트 삭제한다');
reset role;
select is((select deleted_by from public.comments where id = '40000000-0000-0000-0000-00000000ea01'),
  '00000000-0000-0000-0000-00000000ea01'::uuid, '지운 사람이 deleted_by에 남는다');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea02","role":"authenticated"}', true);
select throws_ok(
  $$select public.restore_comment('40000000-0000-0000-0000-00000000ea01', current_setting('test.tok1')::timestamptz)$$,
  'P0001', 'forbidden', '작성자는 관리자가 지운 댓글을 복원할 수 없다');
select isnt(set_config('test.tok2', public.soft_delete_comment('40000000-0000-0000-0000-00000000ea02')::text, true),
  null, '작성자가 자기 댓글을 소프트 삭제한다');
select is(
  (public.restore_comment('40000000-0000-0000-0000-00000000ea02', current_setting('test.tok2')::timestamptz)).deleted_by,
  null, '작성자는 자기가 지운 댓글을 복원하고 deleted_by가 비워진다');
select throws_ok(
  $$update public.comments set deleted_by = null where id = '40000000-0000-0000-0000-00000000ea01'$$,
  '42501', null, 'deleted_by는 직접 바꿀 수 없다');
with i as (
  insert into public.comments (task_id, author_id, body, deleted_by)
  values ('30000000-0000-0000-0000-00000000eaa1', '00000000-0000-0000-0000-00000000ea02', '새 글', '00000000-0000-0000-0000-00000000ea01')
  returning deleted_by
)
select is(deleted_by, null, '댓글 insert의 deleted_by는 비워진다') from i;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea01","role":"authenticated"}', true);
select lives_ok(
  $$select public.restore_comment('40000000-0000-0000-0000-00000000ea01', current_setting('test.tok1')::timestamptz)$$,
  '관리자는 자기가 지운 댓글을 복원한다');

-- ─────────────────────────────────────────────
-- 4. 프로젝트 영구 삭제는 소프트 삭제 뒤에만, 그 전에 관리자가 객체를 지울 수 있다
-- ─────────────────────────────────────────────
select throws_ok($$select public.purge_project('20000000-0000-0000-0000-00000000eab0')$$,
  'P0001', 'invalid_state', '보관만 된 프로젝트는 영구 삭제할 수 없다(객체를 먼저 정리할 수 없다)');
select ok(public.soft_delete_project('20000000-0000-0000-0000-00000000eab0') is not null, '보관된 프로젝트를 소프트 삭제한다');
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000ea00/20000000-0000-0000-0000-00000000eab0/50000000-0000-0000-0000-00000000eab1/r.pdf'),
  true, '보관·소프트 삭제된 프로젝트의 ready 객체를 관리자가 지울 수 있다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ea02","role":"authenticated"}', true);
select is(public.can_remove_file_object(
  '10000000-0000-0000-0000-00000000ea00/20000000-0000-0000-0000-00000000eab0/50000000-0000-0000-0000-00000000eab1/r.pdf'),
  false, '편집자는 삭제된 프로젝트의 ready 객체를 지울 수 없다');

reset role;
select * from finish();
rollback;
