-- 이메일·푸시 발송 마이그레이션(23)을 검증한다. 푸시 구독은 본인 행만 보고 지우며, 사용자는 발송 시각을 바꾸지 못한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000024a1', 'one@ext.test'),
  ('00000000-0000-0000-0000-0000000024a2', 'two@ext.test');
insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000024b1', '외부 알림', 'ext-w1', '00000000-0000-0000-0000-0000000024a1');
insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000024b1', '00000000-0000-0000-0000-0000000024a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000024b1', '00000000-0000-0000-0000-0000000024a2', 'member', 'active');

-- 상대방(2)의 구독과 1의 알림을 소유자 권한으로 만든다
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
  ('50000000-0000-0000-0000-0000000024c2', '00000000-0000-0000-0000-0000000024a2', 'https://push.example/two', 'k2', 'a2');
insert into public.notifications (id, user_id, workspace_id, type, text) values
  ('60000000-0000-0000-0000-0000000024d1', '00000000-0000-0000-0000-0000000024a1', '10000000-0000-0000-0000-0000000024b1', 'comment', '테스트');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);

select is((select count(*) from public.push_subscriptions), 0::bigint, '다른 사용자의 구독은 보이지 않는다');

delete from public.push_subscriptions where id = '50000000-0000-0000-0000-0000000024c2';
select is((select count(*) from public.push_subscriptions), 0::bigint, '다른 사용자의 구독 삭제는 0행이다(오류 없이 무시)');

select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-0000000024a2', 'https://push.example/forged', 'k', 'a')$$,
  '42501', null, '다른 사용자 이름으로는 구독을 등록할 수 없다');

insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
  ('50000000-0000-0000-0000-0000000024c1', '00000000-0000-0000-0000-0000000024a1', 'https://push.example/one', 'k1', 'a1');
select is((select count(*) from public.push_subscriptions), 1::bigint, '본인 구독은 등록하고 볼 수 있다');

select throws_ok(
  $$update public.push_subscriptions set endpoint = 'https://push.example/x' where id = '50000000-0000-0000-0000-0000000024c1'$$,
  '42501', null, '구독 행은 수정할 수 없다');

delete from public.push_subscriptions where id = '50000000-0000-0000-0000-0000000024c1';
select is((select count(*) from public.push_subscriptions), 0::bigint, '본인 구독은 지울 수 있다');

select throws_ok(
  $$update public.notifications set emailed_at = now() where id = '60000000-0000-0000-0000-0000000024d1'$$,
  '42501', null, '사용자는 emailed_at을 바꿀 수 없다');
select throws_ok(
  $$update public.notifications set pushed_at = now() where id = '60000000-0000-0000-0000-0000000024d1'$$,
  '42501', null, '사용자는 pushed_at을 바꿀 수 없다');

select * from finish();
rollback;
