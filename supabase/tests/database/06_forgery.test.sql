-- 클라이언트가 활동·알림·반복 회차·댓글 작성자를 위조하지 못하는지(리뷰 공격 E1~E3, E6, R9)와 서버 알림 규칙을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ─────────────────────────────────────────────
-- 픽스처
-- 사용자 o owner, m member, g guest(PA comment), m2 member(PA full), g2 guest(프로젝트 공유 없음)
-- PA는 워크스페이스 공개, PB는 비공개(o만 본다). PB 작업 secret은 매주 반복이다.
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e601', 'o@example.test'),
  ('00000000-0000-0000-0000-00000000e602', 'm@example.test'),
  ('00000000-0000-0000-0000-00000000e603', 'g@example.test'),
  ('00000000-0000-0000-0000-00000000e604', 'm2@example.test'),
  ('00000000-0000-0000-0000-00000000e605', 'g2@example.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-00000000e600', '워크스페이스', 'ws-e6', '00000000-0000-0000-0000-00000000e601');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000e600', '00000000-0000-0000-0000-00000000e601', 'owner'),
  ('10000000-0000-0000-0000-00000000e600', '00000000-0000-0000-0000-00000000e602', 'member'),
  ('10000000-0000-0000-0000-00000000e600', '00000000-0000-0000-0000-00000000e603', 'guest'),
  ('10000000-0000-0000-0000-00000000e600', '00000000-0000-0000-0000-00000000e604', 'member'),
  ('10000000-0000-0000-0000-00000000e600', '00000000-0000-0000-0000-00000000e605', 'guest');

insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-00000000e6a0', '10000000-0000-0000-0000-00000000e600', 'PA', 'A', 'workspace'),
  ('20000000-0000-0000-0000-00000000e6b0', '10000000-0000-0000-0000-00000000e600', 'PB', 'B', 'private');

insert into public.project_members (project_id, user_id, perm) values
  ('20000000-0000-0000-0000-00000000e6a0', '00000000-0000-0000-0000-00000000e603', 'comment'),
  ('20000000-0000-0000-0000-00000000e6a0', '00000000-0000-0000-0000-00000000e604', 'full');

insert into public.tasks (id, workspace_id, project_id, key, title, sort_order, recur, due_date) values
  ('30000000-0000-0000-0000-00000000e6a1', '10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6a0',
   'PA-101', 'ta', 1, 'none', null),
  ('30000000-0000-0000-0000-00000000e6a2', '10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6a0',
   'PA-102', 'tb', 2, 'none', null),
  ('30000000-0000-0000-0000-00000000e6b1', '10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6b0',
   'PB-101', 'secret', 1, 'weekly', '2026-10-20');

insert into public.comments (id, task_id, author_id, body) values
  ('40000000-0000-0000-0000-00000000e601', '30000000-0000-0000-0000-00000000e6a1', '00000000-0000-0000-0000-00000000e604', 'm2 says hi');

-- 반복 회차는 같은 프로젝트 작업만 가리킨다(복합 FK). postgres로도 다른 프로젝트 작업은 연결할 수 없다.
select throws_ok(
  $$insert into public.tasks (workspace_id, project_id, key, title, sort_order, recur_source_id)
    values ('10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6a0', 'PA-900', 'x', 1,
            '30000000-0000-0000-0000-00000000e6b1')$$,
  '23503', null, 'recur_source_id는 다른 프로젝트 작업을 가리킬 수 없다');

set local role authenticated;

-- ─────────────────────────────────────────────
-- E1. 게스트가 활동·알림을 직접 넣는다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e603","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.activities (workspace_id, project_id, task_id, actor_id, verb, extra)
    values ('10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6a0', '30000000-0000-0000-0000-00000000e6a1',
            '00000000-0000-0000-0000-00000000e603', 'completed', '{"from":"todo","to":"done"}')$$,
  '42501', null, '게스트는 활동을 직접 넣을 수 없다');
select throws_ok(
  $$insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet)
    values ('00000000-0000-0000-0000-00000000e601', '10000000-0000-0000-0000-00000000e600', 'assign',
            '00000000-0000-0000-0000-00000000e603', '30000000-0000-0000-0000-00000000e6a1', '20000000-0000-0000-0000-00000000e6a0',
            '관리자: 비밀번호를 재설정하세요 https://evil.example', 'x')$$,
  '42501', null, '게스트는 다른 사람에게 알림을 직접 넣을 수 없다');

-- ─────────────────────────────────────────────
-- E2. 구성원이 tasks 직접 insert로 비공개 작업의 반복 회차를 가로챈다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e602","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.activities (workspace_id, project_id, actor_id, verb)
    values ('10000000-0000-0000-0000-00000000e600', '20000000-0000-0000-0000-00000000e6a0',
            '00000000-0000-0000-0000-00000000e602', 'created project')$$,
  '42501', null, '편집 권한이 있어도 활동을 직접 넣을 수 없다');

with i as (
  insert into public.tasks (project_id, workspace_id, title, sort_order, recur_source_id, completed_at, status, created_by)
  values ('20000000-0000-0000-0000-00000000e6a0', '10000000-0000-0000-0000-00000000e600', 'hijack', 1,
          '30000000-0000-0000-0000-00000000e6b1', now() - interval '1 year', 'done', '00000000-0000-0000-0000-00000000e601')
  returning recur_source_id, completed_at, created_by
)
select ok(
  recur_source_id is null and completed_at > now() - interval '1 minute'
  and created_by = '00000000-0000-0000-0000-00000000e602',
  '직접 insert의 recur_source_id·completed_at·created_by는 서버 값으로 덮인다') from i;

select throws_ok(
  $$update public.tasks set recur_source_id = '30000000-0000-0000-0000-00000000e6a2'
    where id = '30000000-0000-0000-0000-00000000e6a1'$$,
  'P0001', 'forbidden', 'recur_source_id는 update로 바꿀 수 없다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e601","role":"authenticated"}', true);
-- 같은 문장 안에서는 함수가 넣은 행이 바깥 조회 스냅샷에 보이지 않아 id를 먼저 저장한다
select isnt(
  set_config('test.next', (select next_task_id from public.complete_task('30000000-0000-0000-0000-00000000e6b1'))::text, true),
  null, 'owner의 반복 완료는 다음 회차 id를 돌려준다');
select is(
  (select t.project_id from public.tasks t where t.id = current_setting('test.next')::uuid),
  '20000000-0000-0000-0000-00000000e6b0'::uuid,
  'owner의 반복 완료는 같은 비공개 프로젝트에 새 회차를 만든다');
select is(
  (select title from public.tasks where recur_source_id = '30000000-0000-0000-0000-00000000e6b1'),
  'secret', '가로채기 행이 아닌 원본 복제 회차가 연결된다');

-- ─────────────────────────────────────────────
-- E3. full 권한 구성원이 댓글 작성자·작성 시각을 바꾼다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e604","role":"authenticated"}', true);

select throws_ok(
  $$update public.comments set author_id = '00000000-0000-0000-0000-00000000e601'
    where id = '40000000-0000-0000-0000-00000000e601'$$,
  '42501', null, '댓글 author_id는 바꿀 수 없다');
select throws_ok(
  $$update public.comments set created_at = '2026-01-01' where id = '40000000-0000-0000-0000-00000000e601'$$,
  '42501', null, '댓글 created_at은 바꿀 수 없다');
with u as (
  update public.comments set body = '수정한 본문' where id = '40000000-0000-0000-0000-00000000e601'
  returning author_id
)
select is(author_id, '00000000-0000-0000-0000-00000000e604'::uuid, '본문 수정은 되고 작성자는 그대로다') from u;
with i as (
  insert into public.comments (task_id, author_id, body, created_at)
  values ('30000000-0000-0000-0000-00000000e6a2', '00000000-0000-0000-0000-00000000e604', '과거 댓글', '2020-01-01')
  returning created_at
)
select ok(created_at > now() - interval '1 minute', '댓글 insert의 created_at은 서버 시각이다') from i;

-- ─────────────────────────────────────────────
-- E6·R9. 직접 update도 활동을 남긴다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e603","role":"authenticated"}', true);
with u as (update public.tasks set title = 'g' where id = '30000000-0000-0000-0000-00000000e6a1' returning 1)
select is(count(*), 0::bigint, '게스트의 작업 직접 수정은 0행') from u;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e602","role":"authenticated"}', true);
update public.tasks set status = 'done' where id = '30000000-0000-0000-0000-00000000e6a1';
select is(
  (select count(*) from public.activities
   where task_id = '30000000-0000-0000-0000-00000000e6a1' and verb = 'completed'
     and actor_id = '00000000-0000-0000-0000-00000000e602'),
  1::bigint, '직접 update로 done에 넣으면 completed 활동이 남는다');
update public.tasks set status = 'progress' where id = '30000000-0000-0000-0000-00000000e6a1';
select is(
  (select extra from public.activities
   where task_id = '30000000-0000-0000-0000-00000000e6a1' and verb = 'moved'),
  '{"from":"done","to":"progress"}'::jsonb, 'done에서 나오는 상태 변경은 moved(from, to)로 남는다');
select is(
  (select completed_at from public.tasks where id = '30000000-0000-0000-0000-00000000e6a1'),
  null, 'done에서 나오면 completed_at이 지워진다');

-- 담당자 지정. 활동 assigned와 새 담당자(o)에게 서버 문구 assign 알림
update public.tasks set assignee_id = '00000000-0000-0000-0000-00000000e601', priority = 'high'
where id = '30000000-0000-0000-0000-00000000e6a1';
select is(
  (select count(*) from public.activities
   where task_id = '30000000-0000-0000-0000-00000000e6a1' and verb in ('assigned', 'changed priority of')),
  2::bigint, '담당자·우선순위 변경이 각각 활동으로 남는다');

-- ─────────────────────────────────────────────
-- 알림. 클라이언트가 문구를 정하지 못하고 볼 수 없는 사람에게는 가지 않는다
-- ─────────────────────────────────────────────
-- m2가 ta(담당자 o)에 o·m·g2를 멘션한다. g2는 PA 공유가 없어 받지 않는다.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e604","role":"authenticated"}', true);
select lives_ok(
  $$select public.add_comment('30000000-0000-0000-0000-00000000e6a1', '<p><b>안녕</b>   확인 부탁</p>',
      array['00000000-0000-0000-0000-00000000e601', '00000000-0000-0000-0000-00000000e602',
            '00000000-0000-0000-0000-00000000e605']::uuid[])$$,
  'add_comment로 멘션 댓글을 단다');
select throws_ok(
  $$select public.add_comment('30000000-0000-0000-0000-00000000e6b1', '비공개 작업 댓글')$$,
  'P0001', 'not_found', '볼 수 없는 작업에는 add_comment를 할 수 없다');

reset role;
select is(
  (select type::text || '|' || text from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000e601' and task_id = '30000000-0000-0000-0000-00000000e6a1'
     and type = 'assign'),
  'assign|회원님을 담당자로 지정했습니다', '담당자 지정 알림은 서버 문구다');
select is(
  (select array_agg(type::text order by type) from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000e601' and task_id = '30000000-0000-0000-0000-00000000e6a1'
     and type in ('comment', 'mention')),
  array['mention'], '멘션된 담당자는 comment 대신 mention 하나만 받는다');
select is(
  (select snippet from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000e602' and type = 'mention'),
  '안녕 확인 부탁', '멘션 알림 snippet은 태그를 지운 평문이다');
select is_empty(
  $$select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000e605'$$,
  '프로젝트를 볼 수 없는 사람은 멘션돼도 알림을 받지 않는다');
select is_empty(
  $$select 1 from public.notifications where user_id = actor_id$$,
  '자기 자신에게는 알림을 보내지 않는다');

-- m의 직접 댓글 insert도 담당자 o에게 comment 알림을 남긴다(트리거)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e602","role":"authenticated"}', true);
insert into public.comments (task_id, author_id, body)
values ('30000000-0000-0000-0000-00000000e6a1', '00000000-0000-0000-0000-00000000e602', '직접 댓글');
reset role;
select is(
  (select text from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000e601' and type = 'comment'
     and actor_id = '00000000-0000-0000-0000-00000000e602'),
  '회원님의 작업에 댓글을 남겼습니다', '직접 댓글도 담당자에게 서버 문구 comment 알림을 남긴다');

select * from finish();
rollback;
