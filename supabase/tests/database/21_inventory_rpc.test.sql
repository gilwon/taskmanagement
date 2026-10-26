-- 재고 RPC(018, 019). 입고·출고·이동·조정, 품목·위치 관리, 권한, 안전재고 알림과 기존 알림 회귀를 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(124);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, ad admin, ad2 admin(재고 알림 끔), m member, g guest는 워크스페이스 A, x는 B의 owner
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000021a1', 'u1@stock-rpc.test'),
  ('00000000-0000-0000-0000-0000000021a2', 'u2@stock-rpc.test'),
  ('00000000-0000-0000-0000-0000000021a3', 'u3@stock-rpc.test'),
  ('00000000-0000-0000-0000-0000000021a4', 'u4@stock-rpc.test'),
  ('00000000-0000-0000-0000-0000000021a5', 'u5@stock-rpc.test'),
  ('00000000-0000-0000-0000-0000000021a6', 'u6@stock-rpc.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000021b1', '재고 RPC A', 'stock-rpc-a', '00000000-0000-0000-0000-0000000021a1'),
  ('10000000-0000-0000-0000-0000000021b2', '재고 RPC B', 'stock-rpc-b', '00000000-0000-0000-0000-0000000021a6');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021a2', 'admin', 'active'),
  ('10000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021a3', 'admin', 'active'),
  ('10000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021a4', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021a5', 'guest', 'active'),
  ('10000000-0000-0000-0000-0000000021b2', '00000000-0000-0000-0000-0000000021a6', 'owner', 'active');

insert into public.user_prefs (user_id, workspace_id, notif_prefs) values
  ('00000000-0000-0000-0000-0000000021a3', '10000000-0000-0000-0000-0000000021b1', '{"stock": false}');

-- c1 안전재고 10, c2 안전재고 0, c3 보관, c4 알림용(안전재고 10), c5 B의 품목, c6 위치 보관 규칙용
insert into public.stock_items (id, workspace_id, name, sku, unit, safety_stock, archived_at) values
  ('40000000-0000-0000-0000-0000000021c1', '10000000-0000-0000-0000-0000000021b1', '볼트', 'S-1', 'ea', 10, null),
  ('40000000-0000-0000-0000-0000000021c2', '10000000-0000-0000-0000-0000000021b1', '안전재고 없음', 'Z-1', 'ea', 0, null),
  ('40000000-0000-0000-0000-0000000021c3', '10000000-0000-0000-0000-0000000021b1', '보관 품목', 'ARCH-1', 'ea', 0, now()),
  ('40000000-0000-0000-0000-0000000021c4', '10000000-0000-0000-0000-0000000021b1', '알림 품목', 'ALERT-1', 'ea', 10, null),
  ('40000000-0000-0000-0000-0000000021c5', '10000000-0000-0000-0000-0000000021b2', '다른 품목', 'S-1', 'ea', 0, null),
  ('40000000-0000-0000-0000-0000000021c6', '10000000-0000-0000-0000-0000000021b1', '보관 규칙 품목', 'RULE-1', 'ea', 0, null);

-- d1·d2 일반 위치, d3 보관 규칙용, d4 보관된 위치, d5 B의 위치
insert into public.stock_locations (id, workspace_id, name, archived_at) values
  ('50000000-0000-0000-0000-0000000021d1', '10000000-0000-0000-0000-0000000021b1', 'L1', null),
  ('50000000-0000-0000-0000-0000000021d2', '10000000-0000-0000-0000-0000000021b1', 'L2', null),
  ('50000000-0000-0000-0000-0000000021d3', '10000000-0000-0000-0000-0000000021b1', 'L3', null),
  ('50000000-0000-0000-0000-0000000021d4', '10000000-0000-0000-0000-0000000021b1', 'LA', now()),
  ('50000000-0000-0000-0000-0000000021d5', '10000000-0000-0000-0000-0000000021b2', 'LB', null);

-- 기존 알림 회귀용 프로젝트와 작업
insert into public.projects (id, workspace_id, key, name) values
  ('20000000-0000-0000-0000-0000000021f1', '10000000-0000-0000-0000-0000000021b1', 'SR', '재고 회귀 프로젝트');
insert into public.tasks (id, workspace_id, project_id, key, title, sort_order) values
  ('30000000-0000-0000-0000-0000000021f2', '10000000-0000-0000-0000-0000000021b1', '20000000-0000-0000-0000-0000000021f1', 'SR-1', '회귀 작업', 1000);

set local role authenticated;

-- ─────────────────────────────────────────────
-- 품목 생성·수정·보관(A)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '  너트  ', 'NUT-1', 'ea', '  부품  ', 5)$$,
  'owner가 품목을 만든다(입력은 trim)');
select is(
  (select name || '|' || category || '|' || safety_stock::text from public.stock_items where sku = 'NUT-1'),
  '너트|부품|5.000', '이름·카테고리는 trim되고 안전재고가 저장된다');
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '다른 너트', 'nut-1', 'ea', null, 0)$$,
  'P0001', 'duplicate_sku', 'SKU는 대소문자 무관하게 중복을 거부한다');
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '복사', 'arch-1', 'ea', null, 0)$$,
  'P0001', 'duplicate_sku', '보관된 품목의 SKU도 점유된다');
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '   ', 'E-1', 'ea', null, 0)$$,
  'P0001', 'invalid_qty', '공백뿐인 이름은 거부한다');
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '이름', 'E-2', '  ', null, 0)$$,
  'P0001', 'invalid_qty', '공백뿐인 단위는 거부한다');
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '이름', 'E-3', 'ea', null, -1)$$,
  'P0001', 'invalid_qty', '음수 안전재고는 거부한다');
select lives_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '카테고리 없음', 'NOCAT-1', 'ea', '  ', 0)$$,
  '빈 카테고리는 null로 저장한다');
select is(
  (select category is null from public.stock_items where sku = 'NOCAT-1'),
  true, '공백 카테고리는 null이다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}', true);
select lives_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '와셔', 'WSH-1', 'ea', null, 0)$$,
  'admin도 품목을 만든다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '멤버', 'M-1', 'ea', null, 0)$$,
  'P0001', 'forbidden', 'member는 품목을 만들 수 없다');
select throws_ok(
  $$select public.stock_update_item('40000000-0000-0000-0000-0000000021c1', '볼트', 'S-1', 'ea', null, 10)$$,
  'P0001', 'forbidden', 'member는 품목을 고칠 수 없다');
select throws_ok(
  $$select public.stock_set_item_archived('40000000-0000-0000-0000-0000000021c1', true)$$,
  'P0001', 'forbidden', 'member는 품목을 보관할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a5","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '게스트', 'G-1', 'ea', null, 0)$$,
  'P0001', 'forbidden', 'guest는 품목을 만들 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a6","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_create_item('10000000-0000-0000-0000-0000000021b1', '외부', 'X-1', 'ea', null, 0)$$,
  'P0001', 'forbidden', '비소속은 품목을 만들 수 없다');
select throws_ok(
  $$select public.stock_update_item('40000000-0000-0000-0000-0000000021c1', '볼트', 'S-1', 'ea', null, 10)$$,
  'P0001', 'forbidden', '비소속은 남의 품목을 고칠 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok(
  $$select public.stock_update_item('40000000-0000-0000-0000-0000000021c1', '볼트 개정', 'S-1', 'ea', '부품', 10)$$,
  'owner가 품목을 고친다');
select is(
  (select name from public.stock_items where id = '40000000-0000-0000-0000-0000000021c1'),
  '볼트 개정', '수정이 반영된다');
select throws_ok(
  $$select public.stock_update_item('40000000-0000-0000-0000-0000000021c1', '볼트 개정', 'NUT-1', 'ea', '부품', 10)$$,
  'P0001', 'duplicate_sku', '수정으로 다른 품목의 SKU를 가질 수 없다');
select throws_ok(
  $$select public.stock_update_item('40000000-0000-0000-0000-0000000021ff', 'x', 'x', 'ea', null, 0)$$,
  'P0001', 'not_found', '없는 품목은 not_found다');
select lives_ok(
  $$select public.stock_set_item_archived('40000000-0000-0000-0000-0000000021c6', true)$$,
  'owner가 품목을 보관한다');
select is(
  (select archived_at is not null from public.stock_items where id = '40000000-0000-0000-0000-0000000021c6'),
  true, '보관 시각이 찍힌다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c6', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'archived', '보관 품목은 수량을 바꿀 수 없다');
select lives_ok(
  $$select public.stock_set_item_archived('40000000-0000-0000-0000-0000000021c6', false)$$,
  'owner가 품목 보관을 푼다');
select is(
  (select archived_at is null from public.stock_items where id = '40000000-0000-0000-0000-0000000021c6'),
  true, '보관이 풀린다');

-- ─────────────────────────────────────────────
-- 위치 생성·이름 변경·보관(A)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok(
  $$select public.stock_create_location('10000000-0000-0000-0000-0000000021b1', '  Main-Loc  ')$$,
  'owner가 위치를 만든다');
select is(
  (select count(*)::int from public.stock_locations where name = 'Main-Loc'),
  1, '위치명은 trim되어 저장된다');
select throws_ok(
  $$select public.stock_create_location('10000000-0000-0000-0000-0000000021b1', 'main-loc')$$,
  'P0001', 'duplicate_name', '위치명은 대소문자 무관하게 중복을 거부한다');
select throws_ok(
  $$select public.stock_create_location('10000000-0000-0000-0000-0000000021b1', '   ')$$,
  'P0001', 'invalid_qty', '공백뿐인 위치명은 거부한다');
select lives_ok(
  $$select public.stock_rename_location('50000000-0000-0000-0000-0000000021d3', 'L3 개명')$$,
  'owner가 위치 이름을 바꾼다');
select throws_ok(
  $$select public.stock_rename_location('50000000-0000-0000-0000-0000000021d3', 'l1')$$,
  'P0001', 'duplicate_name', '다른 위치와 같은 이름으로 바꿀 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_create_location('10000000-0000-0000-0000-0000000021b1', '멤버 위치')$$,
  'P0001', 'forbidden', 'member는 위치를 만들 수 없다');
select throws_ok(
  $$select public.stock_rename_location('50000000-0000-0000-0000-0000000021d1', '멤버')$$,
  'P0001', 'forbidden', 'member는 위치 이름을 바꿀 수 없다');
select throws_ok(
  $$select public.stock_set_location_archived('50000000-0000-0000-0000-0000000021d3', true)$$,
  'P0001', 'forbidden', 'member는 위치를 보관할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c6', '50000000-0000-0000-0000-0000000021d3', 5, '메모')$$,
  '보관 규칙 검증용으로 L3에 입고한다');
select throws_ok(
  $$select public.stock_set_location_archived('50000000-0000-0000-0000-0000000021d3', true)$$,
  'P0001', 'location_not_empty', '수량이 있는 위치는 보관할 수 없다');
select lives_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c6', '50000000-0000-0000-0000-0000000021d3', 5, '메모')$$,
  'L3를 비운다');
select lives_ok(
  $$select public.stock_set_location_archived('50000000-0000-0000-0000-0000000021d3', true)$$,
  '비운 위치는 보관할 수 있다');
select is(
  (select archived_at is not null from public.stock_locations where id = '50000000-0000-0000-0000-0000000021d3'),
  true, '위치 보관 시각이 찍힌다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c6', '50000000-0000-0000-0000-0000000021d3', 1, '메모')$$,
  'P0001', 'archived', '보관된 위치에는 입고할 수 없다');
select lives_ok(
  $$select public.stock_set_location_archived('50000000-0000-0000-0000-0000000021d3', false)$$,
  '위치 보관을 푼다');

-- ─────────────────────────────────────────────
-- 입고·출고·이동·조정(품목 c1, 안전재고 10이지만 합계는 10 아래로 내려가지 않는다)
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 100, 'init') m),
  'in|100.000|100.000|100.000', 'L1에 100 입고');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d2', 30, '메모') m),
  'in|30.000|30.000|130.000', 'L2에 30 입고, 합계는 130');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 20, '메모') m),
  'out|20.000|80.000|110.000', 'L1에서 20 출고');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d2', 10, '메모') m),
  'in|10.000|40.000|120.000', 'member가 입고한다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d2', 10, '메모') m),
  'out|10.000|30.000|110.000', 'member가 출고한다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 25, '메모') m),
  'transfer|25.000|55.000|110.000', 'member가 이동한다(합계 불변)');
select is(
  (select (select qty from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000021c1' and location_id = '50000000-0000-0000-0000-0000000021d1')::text || '|' || (select qty from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000021c1' and location_id = '50000000-0000-0000-0000-0000000021d2')::text),
  '55.000|55.000', '이동 뒤 두 위치 수량이 맞다');
select is(
  (select to_location_id::text from public.stock_movements where item_id = '40000000-0000-0000-0000-0000000021c1' and kind = 'transfer'),
  '50000000-0000-0000-0000-0000000021d2', '이동 이력에 도착 위치가 남는다');
select is(
  (select created_by::text from public.stock_movements where item_id = '40000000-0000-0000-0000-0000000021c1' and kind = 'transfer'),
  '00000000-0000-0000-0000-0000000021a4', '이력 created_by는 호출자다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d2', 500, '메모')$$,
  'P0001', 'insufficient_stock', '재고보다 많은 출고는 거부한다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 100, '메모')$$,
  'P0001', 'insufficient_stock', '재고보다 많은 이동은 거부한다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'same_location', '같은 위치로는 이동할 수 없다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d4', 1, '메모')$$,
  'P0001', 'archived', '보관된 위치로는 이동할 수 없다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d5', 1, '메모')$$,
  'P0001', 'not_found', '다른 워크스페이스 위치로는 이동할 수 없다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d2', 1, '메모')$$,
  'P0001', 'insufficient_stock', '수량 행이 없는 위치에서는 출고할 수 없다');
select is(
  (select (select qty from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000021c1' and location_id = '50000000-0000-0000-0000-0000000021d1')::text || '|' || (select sum(qty) from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000021c1')::text),
  '55.000|110.000', '거부된 요청은 수량을 바꾸지 않는다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 50, '메모')$$,
  'P0001', 'forbidden', 'member는 조정할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 50, '실사') m),
  'adjust|-5.000|50.000|105.000', '조정은 차이를 부호 있는 qty로 남긴다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 50, '메모')$$,
  'P0001', 'invalid_qty', '현재와 같은 목표는 거부한다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', -1, '메모')$$,
  'P0001', 'invalid_qty', '음수 목표는 거부한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 60, '메모') m),
  'adjust|10.000|60.000|115.000', '늘리는 조정은 양수 qty다');
select is(
  (select count(*)::int from public.stock_movements where item_id = '40000000-0000-0000-0000-0000000021c1'),
  8, '거부된 요청은 이력을 남기지 않는다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  0, '합계가 임계값 위인 동안 재고 알림은 없다(이동 포함)');

-- ─────────────────────────────────────────────
-- 잘못된 수량·권한·대상
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 0, '메모')$$,
  'P0001', 'invalid_qty', '입고 0은 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', -1, '메모')$$,
  'P0001', 'invalid_qty', '음수 입고는 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', null, '메모')$$,
  'P0001', 'invalid_qty', 'null 수량은 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 0.0001, '메모')$$,
  'P0001', 'invalid_qty', '소수 3자리를 넘는 수량은 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021ff', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'not_found', '없는 품목은 not_found다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d5', 1, '메모')$$,
  'P0001', 'not_found', '다른 워크스페이스 위치는 not_found다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c3', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'archived', '보관 품목 입고는 archived다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d4', 1, '메모')$$,
  'P0001', 'archived', '보관 위치 입고는 archived다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a5","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'forbidden', 'guest는 입고할 수 없다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'forbidden', 'guest는 출고할 수 없다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 1, '메모')$$,
  'P0001', 'forbidden', 'guest는 이동할 수 없다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'forbidden', 'guest는 조정할 수 없다');
select throws_ok(
  $$select public.stock_create_location('10000000-0000-0000-0000-0000000021b1', '게스트 위치')$$,
  'P0001', 'forbidden', 'guest는 위치를 만들 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a6","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'forbidden', '비소속은 입고할 수 없다');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '메모')$$,
  'P0001', 'unauthenticated', '로그인하지 않으면 거부한다');

-- ─────────────────────────────────────────────
-- 안전재고 알림(c4, 안전재고 10). 임계값을 처음 가로지를 때만 owner·admin에게 1건씩
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 12, '메모') m),
  'in|12.000|12.000|12.000', '12 입고(이전 합계 0이라 알림 없음)');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  0, '임계값 위로 채우는 입고는 알리지 않는다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 5, '메모') m),
  'out|5.000|7.000|7.000', '5 출고로 합계가 7이 된다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  1, 'owner가 알림을 1건 받는다');
select is(
  (select type::text || '|' || text || '|' || snippet || '|' || (stock_item_id = '40000000-0000-0000-0000-0000000021c4')::text || '|' || (task_id is null)::text || '|' || (project_id is null)::text || '|' || (workspace_id = '10000000-0000-0000-0000-0000000021b1')::text || '|' || (actor_id = '00000000-0000-0000-0000-0000000021a1')::text from public.notifications where type = 'stock'),
  'stock|알림 품목|7 / 10|true|true|true|true|true', '알림 내용이 서버 문구와 품목 링크로 만들어진다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  1, 'admin도 1건 받는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a3","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  0, 'notif_prefs stock=false인 admin은 받지 않는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  0, 'member는 받지 않는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a5","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  0, 'guest는 받지 않는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 2, '메모') m),
  'out|2.000|5.000|5.000', '이미 임계값 아래에서 추가 출고');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  1, '같은 상태의 추가 출고는 알림을 더 만들지 않는다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 10, '메모') m),
  'in|10.000|15.000|15.000', '입고로 임계값 위로 회복');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  1, '회복 입고는 알리지 않는다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 6, '메모') m),
  'out|6.000|9.000|9.000', '다시 임계값 아래로 내려간다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  2, '회복 뒤 다시 떨어지면 새 알림이다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  2, 'admin도 새 알림을 받는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_transfer('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 4, '메모') m),
  'transfer|4.000|5.000|9.000', '임계값 아래에서 이동');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  2, '이동은 알림을 만들지 않는다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_adjust('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 16, '메모') m),
  'adjust|11.000|16.000|20.000', '조정으로 합계를 20으로 올린다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  2, '조정으로 올려도 알리지 않는다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_adjust('40000000-0000-0000-0000-0000000021c4', '50000000-0000-0000-0000-0000000021d1', 1, '메모') m),
  'adjust|-15.000|1.000|5.000', '조정으로 합계를 5로 내린다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  3, '조정이 임계값을 가로지르면 알린다');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_receive('40000000-0000-0000-0000-0000000021c2', '50000000-0000-0000-0000-0000000021d1', 5, '메모') m),
  'in|5.000|5.000|5.000', '안전재고 0 품목에 입고');
select is(
  (select m.kind || '|' || m.qty::text || '|' || m.balance_after::text || '|' || m.total_after::text
   from public.stock_issue('40000000-0000-0000-0000-0000000021c2', '50000000-0000-0000-0000-0000000021d1', 5, '메모') m),
  'out|5.000|0.000|0.000', '안전재고 0 품목을 비운다');
select is(
  (select count(*)::int from public.notifications where type = 'stock'),
  3, '안전재고가 0이면 알리지 않는다');

-- ─────────────────────────────────────────────
-- 메모 필수(019). null·빈 문자열·공백뿐인 메모는 note_required로 거부하고 아무것도 바꾸지 않는다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, null)$$,
  'P0001', 'note_required', '입고는 null를 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '')$$,
  'P0001', 'note_required', '입고는 빈 문자열를 거부한다');
select throws_ok(
  $$select public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '   ')$$,
  'P0001', 'note_required', '입고는 공백뿐인 메모를 거부한다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, null)$$,
  'P0001', 'note_required', '출고는 null를 거부한다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '')$$,
  'P0001', 'note_required', '출고는 빈 문자열를 거부한다');
select throws_ok(
  $$select public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '   ')$$,
  'P0001', 'note_required', '출고는 공백뿐인 메모를 거부한다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 1, null)$$,
  'P0001', 'note_required', '이동는 null를 거부한다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 1, '')$$,
  'P0001', 'note_required', '이동는 빈 문자열를 거부한다');
select throws_ok(
  $$select public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 1, '   ')$$,
  'P0001', 'note_required', '이동는 공백뿐인 메모를 거부한다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 70, null)$$,
  'P0001', 'note_required', '조정는 null를 거부한다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 70, '')$$,
  'P0001', 'note_required', '조정는 빈 문자열를 거부한다');
select throws_ok(
  $$select public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 70, '   ')$$,
  'P0001', 'note_required', '조정는 공백뿐인 메모를 거부한다');
select is(
  (select (select sum(qty) from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000021c1')::text || '|' || (select count(*) from public.stock_movements where item_id = '40000000-0000-0000-0000-0000000021c1')::text),
  '115.000|8', '메모 거부된 요청은 수량과 이력을 바꾸지 않는다');
select is(
  (select m.note from public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '  입고 메모  ') m),
  '입고 메모', '메모의 앞뒤 공백은 잘려 저장된다');
select is(
  (select char_length(m.note)::text || '|' || (m.note = repeat('a', 500))::text from public.stock_receive('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '  ' || repeat('a', 600) || '  ') m),
  '500|true', '입고 메모는 trim 뒤 앞 500자만 저장된다');
select is(
  (select char_length(m.note)::text || '|' || (m.note = repeat('a', 500))::text from public.stock_issue('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 1, '  ' || repeat('a', 600) || '  ') m),
  '500|true', '출고 메모는 trim 뒤 앞 500자만 저장된다');
select is(
  (select char_length(m.note)::text || '|' || (m.note = repeat('a', 500))::text from public.stock_transfer('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', '50000000-0000-0000-0000-0000000021d2', 1, '  ' || repeat('a', 600) || '  ') m),
  '500|true', '이동 메모는 trim 뒤 앞 500자만 저장된다');
select is(
  (select char_length(m.note)::text || '|' || (m.note = repeat('a', 500))::text from public.stock_adjust('40000000-0000-0000-0000-0000000021c1', '50000000-0000-0000-0000-0000000021d1', 70, '  ' || repeat('a', 600) || '  ') m),
  '500|true', '조정 메모는 trim 뒤 앞 500자만 저장된다');

-- ─────────────────────────────────────────────
-- 기존 알림 회귀. 작업 배정 알림이 이전처럼 생긴다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
select lives_ok(
  $$update public.tasks set assignee_id = '00000000-0000-0000-0000-0000000021a4' where id = '30000000-0000-0000-0000-0000000021f2'$$,
  'owner가 작업 담당자를 member로 지정한다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a4","role":"authenticated"}', true);
select is(
  (select type::text || '|' || text from public.notifications where task_id = '30000000-0000-0000-0000-0000000021f2'),
  'assign|회원님을 담당자로 지정했습니다', '기존 private.notify 경로의 assign 알림이 생성된다');

select * from finish();
rollback;
