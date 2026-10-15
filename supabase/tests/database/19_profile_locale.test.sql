-- 표시 언어(015). 본인만 profiles.locale을 바꿀 수 있고, 목록 밖 값은 check 제약이 거부한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ─────────────────────────────────────────────
-- 픽스처
-- a·b는 같은 워크스페이스 구성원이라 서로의 프로필을 조회할 수 있다
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000019a1', 'a@locale.test'),
  ('00000000-0000-0000-0000-0000000019a2', 'b@locale.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000019b1', '로캘', 'locale-w', '00000000-0000-0000-0000-0000000019a1');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000019b1', '00000000-0000-0000-0000-0000000019a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000019b1', '00000000-0000-0000-0000-0000000019a2', 'member', 'active');

select is((select locale from public.profiles where id = '00000000-0000-0000-0000-0000000019a1'), 'ko', '기본값은 ko다');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);

update public.profiles set locale = 'en' where id = '00000000-0000-0000-0000-0000000019a1';
select is((select locale from public.profiles where id = '00000000-0000-0000-0000-0000000019a1'), 'en', '본인은 locale을 바꿀 수 있다');

-- 남의 행은 RLS가 걸러 0행이 바뀐다
update public.profiles set locale = 'ja' where id = '00000000-0000-0000-0000-0000000019a2';
select is((select locale from public.profiles where id = '00000000-0000-0000-0000-0000000019a2'), 'ko', '남의 locale은 바꿀 수 없다');

select throws_ok(
  $$update public.profiles set locale = 'fr' where id = '00000000-0000-0000-0000-0000000019a1'$$,
  '23514', null, '목록 밖 로캘은 check 제약이 거부한다');
select throws_ok(
  $$update public.profiles set locale = 'zh-TW' where id = '00000000-0000-0000-0000-0000000019a1'$$,
  '23514', null, '번체 zh-TW도 아직 거부한다');
reset role;

select * from finish();
rollback;
