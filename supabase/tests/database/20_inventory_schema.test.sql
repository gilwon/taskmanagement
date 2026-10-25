-- 재고 스키마(017). 워크스페이스 격리, 역할별 읽기, 직접 쓰기 거부, 이력 불변, 제약을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- ─────────────────────────────────────────────
-- 픽스처
-- a1 owner, a2 admin, a3 member, a4 guest는 워크스페이스 A, a5는 다른 워크스페이스 B의 owner
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000020a1', 'a1@stock-schema.test'),
  ('00000000-0000-0000-0000-0000000020a2', 'a2@stock-schema.test'),
  ('00000000-0000-0000-0000-0000000020a3', 'a3@stock-schema.test'),
  ('00000000-0000-0000-0000-0000000020a4', 'a4@stock-schema.test'),
  ('00000000-0000-0000-0000-0000000020a5', 'a5@stock-schema.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000020b1', '재고 A', 'stock-schema-a', '00000000-0000-0000-0000-0000000020a1'),
  ('10000000-0000-0000-0000-0000000020b2', '재고 B', 'stock-schema-b', '00000000-0000-0000-0000-0000000020a5');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000020a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000020a2', 'admin', 'active'),
  ('10000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000020a3', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000020a4', 'guest', 'active'),
  ('10000000-0000-0000-0000-0000000020b2', '00000000-0000-0000-0000-0000000020a5', 'owner', 'active');

-- c1은 활성 품목, c2는 보관 품목(SKU는 계속 점유), c3은 B의 품목(같은 SKU를 써도 된다)
insert into public.stock_items (id, workspace_id, name, sku, unit, archived_at) values
  ('40000000-0000-0000-0000-0000000020c1', '10000000-0000-0000-0000-0000000020b1', '볼트', 'S-1', 'ea', null),
  ('40000000-0000-0000-0000-0000000020c2', '10000000-0000-0000-0000-0000000020b1', '보관 품목', 'ARCH-1', 'ea', now()),
  ('40000000-0000-0000-0000-0000000020c3', '10000000-0000-0000-0000-0000000020b2', '다른 볼트', 'S-1', 'ea', null);

insert into public.stock_locations (id, workspace_id, name) values
  ('50000000-0000-0000-0000-0000000020d1', '10000000-0000-0000-0000-0000000020b1', '본사 창고'),
  ('50000000-0000-0000-0000-0000000020d2', '10000000-0000-0000-0000-0000000020b2', '다른 창고');

insert into public.stock_levels (item_id, location_id, workspace_id, qty) values
  ('40000000-0000-0000-0000-0000000020c1', '50000000-0000-0000-0000-0000000020d1', '10000000-0000-0000-0000-0000000020b1', 10);

insert into public.stock_movements (id, workspace_id, item_id, kind, location_id, qty, balance_after, total_after) values
  ('60000000-0000-0000-0000-0000000020e1', '10000000-0000-0000-0000-0000000020b1',
   '40000000-0000-0000-0000-0000000020c1', 'in', '50000000-0000-0000-0000-0000000020d1', 10, 10, 10);

select is((select count(*)::int from public.stock_items where workspace_id = '10000000-0000-0000-0000-0000000020b2'),
  1, '다른 워크스페이스는 같은 SKU를 쓸 수 있다');

-- ─────────────────────────────────────────────
-- 읽기. owner·admin·member만, 같은 워크스페이스만
-- ─────────────────────────────────────────────
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select is((select count(*)::int from public.stock_items), 2, 'owner는 자기 워크스페이스 품목을 읽는다');
select is(
  (select count(*)::int from public.stock_locations) + (select count(*)::int from public.stock_levels)
    + (select count(*)::int from public.stock_movements),
  3, 'owner는 위치·수량·이력을 읽는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a2","role":"authenticated"}', true);
select is((select count(*)::int from public.stock_items), 2, 'admin은 품목을 읽는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a3","role":"authenticated"}', true);
select is((select count(*)::int from public.stock_items), 2, 'member는 품목을 읽는다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a4","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.stock_items) + (select count(*)::int from public.stock_locations)
    + (select count(*)::int from public.stock_levels) + (select count(*)::int from public.stock_movements),
  0, 'guest는 재고를 하나도 읽지 못한다');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a5","role":"authenticated"}', true);
select is((select count(*)::int from public.stock_items where workspace_id = '10000000-0000-0000-0000-0000000020b1'),
  0, '다른 워크스페이스 구성원은 A의 품목을 읽지 못한다');
select is(
  (select count(*)::int from public.stock_items) + (select count(*)::int from public.stock_locations)
    + (select count(*)::int from public.stock_levels) + (select count(*)::int from public.stock_movements),
  2, '다른 워크스페이스 구성원은 자기 품목과 위치만 읽는다');

-- ─────────────────────────────────────────────
-- 직접 쓰기 거부(owner도 RPC로만 쓴다)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.stock_items (workspace_id, name, sku, unit)
    values ('10000000-0000-0000-0000-0000000020b1', 'x', 'X-1', 'ea')$$,
  '42501', null, 'stock_items 직접 insert는 거부된다');
select throws_ok(
  $$update public.stock_items set name = 'y' where id = '40000000-0000-0000-0000-0000000020c1'$$,
  '42501', null, 'stock_items 직접 update는 거부된다');
select throws_ok(
  $$delete from public.stock_items where id = '40000000-0000-0000-0000-0000000020c1'$$,
  '42501', null, 'stock_items 직접 delete는 거부된다');
select throws_ok(
  $$insert into public.stock_locations (workspace_id, name) values ('10000000-0000-0000-0000-0000000020b1', 'y')$$,
  '42501', null, 'stock_locations 직접 insert는 거부된다');
select throws_ok(
  $$insert into public.stock_levels (item_id, location_id, workspace_id, qty)
    values ('40000000-0000-0000-0000-0000000020c2', '50000000-0000-0000-0000-0000000020d1',
            '10000000-0000-0000-0000-0000000020b1', 5)$$,
  '42501', null, 'stock_levels 직접 insert는 거부된다');
select throws_ok(
  $$update public.stock_levels set qty = 999$$,
  '42501', null, 'stock_levels 직접 update는 거부된다');
select throws_ok(
  $$insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after)
    values ('10000000-0000-0000-0000-0000000020b1', '40000000-0000-0000-0000-0000000020c1', 'in',
            '50000000-0000-0000-0000-0000000020d1', 1, 1, 1)$$,
  '42501', null, 'stock_movements 직접 insert는 거부된다');
select throws_ok(
  $$delete from public.stock_movements$$,
  '42501', null, 'stock_movements 직접 delete는 거부된다');

reset role;
set local role anon;
select throws_ok($$select * from public.stock_items$$, '42501', null, 'anon은 재고를 읽지 못한다');
reset role;

-- ─────────────────────────────────────────────
-- 이력 불변. postgres 권한으로도 트리거가 막는다
-- ─────────────────────────────────────────────
select throws_ok(
  $$update public.stock_movements set note = '바꿈' where id = '60000000-0000-0000-0000-0000000020e1'$$,
  'P0001', 'immutable', '이력 update는 postgres도 막힌다');
select throws_ok(
  $$delete from public.stock_movements where id = '60000000-0000-0000-0000-0000000020e1'$$,
  'P0001', 'immutable', '이력 delete는 postgres도 막힌다');

-- ─────────────────────────────────────────────
-- 제약
-- ─────────────────────────────────────────────
select throws_ok(
  $$insert into public.stock_items (workspace_id, name, sku, unit)
    values ('10000000-0000-0000-0000-0000000020b1', '중복', 'arch-1', 'ea')$$,
  '23505', null, '보관된 품목의 SKU도 대소문자 무관하게 점유된다');
select throws_ok(
  $$insert into public.stock_locations (workspace_id, name) values ('10000000-0000-0000-0000-0000000020b1', '본사 창고')$$,
  '23505', null, '위치명은 워크스페이스 안에서 유일하다');
select throws_ok(
  $$insert into public.stock_items (workspace_id, name, sku, unit)
    values ('10000000-0000-0000-0000-0000000020b1', '   ', 'E-1', 'ea')$$,
  '23514', null, '공백만인 이름은 거부된다');
select throws_ok(
  $$insert into public.stock_items (workspace_id, name, sku, unit, safety_stock)
    values ('10000000-0000-0000-0000-0000000020b1', '음수', 'N-1', 'ea', -1)$$,
  '23514', null, '안전재고는 음수일 수 없다');
select throws_ok(
  $$update public.stock_levels set qty = -1$$,
  '23514', null, '수량은 음수일 수 없다');
select throws_ok(
  $$insert into public.stock_levels (item_id, location_id, workspace_id, qty)
    values ('40000000-0000-0000-0000-0000000020c1', '50000000-0000-0000-0000-0000000020d2',
            '10000000-0000-0000-0000-0000000020b1', 1)$$,
  '23503', null, '다른 워크스페이스 위치에는 수량을 둘 수 없다');
select throws_ok(
  $$insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after)
    values ('10000000-0000-0000-0000-0000000020b1', '40000000-0000-0000-0000-0000000020c1', 'transfer',
            '50000000-0000-0000-0000-0000000020d1', 1, 1, 1)$$,
  '23514', null, '이동 이력은 도착 위치가 있어야 한다');
select throws_ok(
  $$insert into public.stock_movements (workspace_id, item_id, kind, location_id, to_location_id, qty, balance_after, total_after)
    values ('10000000-0000-0000-0000-0000000020b1', '40000000-0000-0000-0000-0000000020c1', 'in',
            '50000000-0000-0000-0000-0000000020d1', '50000000-0000-0000-0000-0000000020d1', 1, 1, 1)$$,
  '23514', null, '이동이 아닌 이력은 도착 위치를 가질 수 없다');
select throws_ok(
  $$insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after)
    values ('10000000-0000-0000-0000-0000000020b1', '40000000-0000-0000-0000-0000000020c1', 'adjust',
            '50000000-0000-0000-0000-0000000020d1', 0, 1, 1)$$,
  '23514', null, '조정 이력 수량은 0일 수 없다');

-- ─────────────────────────────────────────────
-- 알림은 task·project 없이 품목만 가리킬 수 있다
-- ─────────────────────────────────────────────
select lives_ok(
  $$insert into public.notifications (user_id, workspace_id, type, stock_item_id, text)
    values ('00000000-0000-0000-0000-0000000020a1', '10000000-0000-0000-0000-0000000020b1', 'stock',
            '40000000-0000-0000-0000-0000000020c1', '볼트')$$,
  'stock 알림은 task_id·project_id 없이 만들 수 있다');

select * from finish();
rollback;
