-- 작업 제목·상태·우선순위·마감일 변경 시 담당자 update 알림(마이그레이션 22)을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- 픽스처. a 변경자(owner), b 담당자(member), c 새 담당자 후보(member)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a1', 'actor@nu.test'),
  ('00000000-0000-0000-0000-0000000023a2', 'assignee@nu.test'),
  ('00000000-0000-0000-0000-0000000023a3', 'other@nu.test');
insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000023b1', '알림', 'nu-w1', '00000000-0000-0000-0000-0000000023a1');
insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000023b1', '00000000-0000-0000-0000-0000000023a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000023b1', '00000000-0000-0000-0000-0000000023a2', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000023b1', '00000000-0000-0000-0000-0000000023a3', 'member', 'active');
insert into public.projects (id, workspace_id, key, name, access) values
  ('20000000-0000-0000-0000-0000000023c1', '10000000-0000-0000-0000-0000000023b1', 'NU', '알림 프로젝트', 'workspace');

set local role authenticated;

-- 변경자가 담당자 b인 작업을 만든다(assign 알림 1건은 update 집계와 무관).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
insert into public.tasks (id, project_id, title, assignee_id, sort_order)
  values ('40000000-0000-0000-0000-0000000023e1', '20000000-0000-0000-0000-0000000023c1', '원래 제목',
          '00000000-0000-0000-0000-0000000023a2', 1);

-- 타인이 한 필드씩 바꾼다.
update public.tasks set title = '새 제목' where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 1::bigint, '타인이 제목을 바꾸면 담당자에게 update 1건');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set status = 'progress' where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 2::bigint, '상태 변경도 update 1건');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set priority = 'high' where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 3::bigint, '우선순위 변경도 update 1건');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set due_date = '2030-01-01' where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 4::bigint, '마감일 변경도 update 1건');

-- 한 UPDATE에서 여러 필드가 바뀌어도 1건이다.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set title = '또 새 제목', priority = 'low', due_date = '2030-02-02'
  where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 5::bigint, '여러 필드를 함께 바꿔도 update는 1건');

-- 담당자 본인의 변경은 알림이 없다.
update public.tasks set title = '본인이 바꿈' where id = '40000000-0000-0000-0000-0000000023e1';
select is((select count(*) from public.notifications where type = 'update'), 5::bigint, '본인 변경은 update를 만들지 않는다');

-- update 알림을 끄면 만들지 않는다.
insert into public.user_prefs (user_id, workspace_id, notif_prefs)
  values ('00000000-0000-0000-0000-0000000023a2', '10000000-0000-0000-0000-0000000023b1', '{"update": false}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set status = 'done' where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 5::bigint, 'notif_prefs.update=false면 update를 만들지 않는다');

-- 담당자를 바꾸면(제목도 함께) assign만 가고 update는 가지 않는다.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
update public.tasks set assignee_id = '00000000-0000-0000-0000-0000000023a3', title = '담당자와 함께'
  where id = '40000000-0000-0000-0000-0000000023e1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a3","role":"authenticated"}', true);
select is((select count(*) from public.notifications where type = 'update'), 0::bigint, '담당자 변경과 함께 바뀐 필드는 update를 만들지 않는다');
select is((select count(*) from public.notifications where type = 'assign'), 1::bigint, '새 담당자에게는 assign 1건만 간다');

select * from finish();
rollback;
