-- 재고 엑셀 업로드 RPC(020). 권한, 메모 필수, 생성·조정·건너뜀, 전체 롤백, 오류 종류별 거부, 안전재고 알림을 검증한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

-- ─────────────────────────────────────────────
-- 픽스처
-- o owner, ad admin, m member, g guest는 워크스페이스 A, x는 B의 owner
-- ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000022a1', 'u1@stock-import.test'),
  ('00000000-0000-0000-0000-0000000022a2', 'u2@stock-import.test'),
  ('00000000-0000-0000-0000-0000000022a3', 'u3@stock-import.test'),
  ('00000000-0000-0000-0000-0000000022a4', 'u4@stock-import.test'),
  ('00000000-0000-0000-0000-0000000022a5', 'u5@stock-import.test');

insert into public.workspaces (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-0000000022b1', '재고 업로드 A', 'stock-import-a', '00000000-0000-0000-0000-0000000022a1'),
  ('10000000-0000-0000-0000-0000000022b2', '재고 업로드 B', 'stock-import-b', '00000000-0000-0000-0000-0000000022a5');

insert into public.workspace_members (workspace_id, user_id, role, status) values
  ('10000000-0000-0000-0000-0000000022b1', '00000000-0000-0000-0000-0000000022a1', 'owner', 'active'),
  ('10000000-0000-0000-0000-0000000022b1', '00000000-0000-0000-0000-0000000022a2', 'admin', 'active'),
  ('10000000-0000-0000-0000-0000000022b1', '00000000-0000-0000-0000-0000000022a3', 'member', 'active'),
  ('10000000-0000-0000-0000-0000000022b1', '00000000-0000-0000-0000-0000000022a4', 'guest', 'active'),
  ('10000000-0000-0000-0000-0000000022b2', '00000000-0000-0000-0000-0000000022a5', 'owner', 'active');

-- c1 기존 품목, c2 보관 품목, c3 알림용(안전재고 10, L1에 20)
insert into public.stock_items (id, workspace_id, name, sku, unit, safety_stock, archived_at) values
  ('40000000-0000-0000-0000-0000000022c1', '10000000-0000-0000-0000-0000000022b1', '볼트', 'S-1', 'ea', 0, null),
  ('40000000-0000-0000-0000-0000000022c2', '10000000-0000-0000-0000-0000000022b1', '보관 품목', 'ARCH-1', 'ea', 0, now()),
  ('40000000-0000-0000-0000-0000000022c3', '10000000-0000-0000-0000-0000000022b1', '알림 품목', 'ALERT-1', 'ea', 10, null);

-- d1 L1, d2 L2, d3 보관된 위치 LA, d4 B의 위치
insert into public.stock_locations (id, workspace_id, name, archived_at) values
  ('50000000-0000-0000-0000-0000000022d1', '10000000-0000-0000-0000-0000000022b1', 'L1', null),
  ('50000000-0000-0000-0000-0000000022d2', '10000000-0000-0000-0000-0000000022b1', 'L2', null),
  ('50000000-0000-0000-0000-0000000022d3', '10000000-0000-0000-0000-0000000022b1', 'LA', now()),
  ('50000000-0000-0000-0000-0000000022d4', '10000000-0000-0000-0000-0000000022b2', 'LB', null);

insert into public.stock_levels (item_id, location_id, workspace_id, qty) values
  ('40000000-0000-0000-0000-0000000022c3', '50000000-0000-0000-0000-0000000022d1', '10000000-0000-0000-0000-0000000022b1', 20);

-- stock_import를 호출해 결과를 문자열로 돌려주는 검증용 헬퍼다. 성공이면 'ok|생성/조정/건너뜀'이고
-- 실패면 '메시지|detail'이다. 오류 detail은 throws_ok로 볼 수 없어서 예외 블록에서 잡는다.
create function pg_temp.imp(p_ws uuid, p_rows jsonb, p_note text)
returns text
language plpgsql
as $$
declare
  v_r jsonb;
  v_msg text;
  v_det text;
begin
  v_r := public.stock_import(p_ws, p_rows, p_note);
  return 'ok|' || (v_r ->> 'created') || '/' || (v_r ->> 'adjusted') || '/' || (v_r ->> 'skipped');
exception when others then
  get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
  return v_msg || '|' || coalesce(v_det, '');
end;
$$;

-- 워크스페이스 A로 보내는 단축 헬퍼
create function pg_temp.impa(p_rows text, p_note text)
returns text
language sql
as $$
  select pg_temp.imp('10000000-0000-0000-0000-0000000022b1', p_rows::jsonb, p_note);
$$;

set local role authenticated;

-- ─────────────────────────────────────────────
-- 권한. owner·admin만 허용한다
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a3","role":"authenticated"}', true);
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', '메모'),
  'forbidden|', 'member는 업로드할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a4","role":"authenticated"}', true);
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', '메모'),
  'forbidden|', 'guest는 업로드할 수 없다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a5","role":"authenticated"}', true);
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', '메모'),
  'forbidden|', '다른 워크스페이스의 owner는 업로드할 수 없다');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', '메모'),
  'unauthenticated|', '로그인하지 않으면 거부한다');
select is(
  (select count(*)::int from public.stock_movements), 0, '거부된 호출은 이력을 남기지 않는다');

-- ─────────────────────────────────────────────
-- 메모와 행 목록 형식
-- ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a1","role":"authenticated"}', true);
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', null),
  'note_required|', '메모가 null이면 거부한다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":1}]', '   '),
  'note_required|', '공백뿐인 메모는 거부한다');
select is(pg_temp.impa('[]', '메모'), 'invalid_import|', '빈 배열은 거부한다');
select is(pg_temp.impa('{"row":2}', '메모'), 'invalid_import|', '배열이 아니면 거부한다');
select is(pg_temp.impa('[{"sku":"S-1","location":"L1","qty":1}]', '메모'), 'invalid_import|', 'row가 없으면 거부한다');
select is(pg_temp.impa('[{"row":"x","sku":"S-1","location":"L1","qty":1}]', '메모'), 'invalid_import|', 'row가 숫자가 아니면 거부한다');
select is(
  pg_temp.imp('10000000-0000-0000-0000-0000000022b1',
    (select jsonb_agg(jsonb_build_object('row', g + 1, 'sku', 'B' || g, 'location', 'L1', 'qty', 0)) from generate_series(1, 1001) g),
    '메모'),
  'invalid_import|', '1001행은 거부한다');
select is(
  (select count(*)::int from public.stock_items where sku like 'B%'), 0, '1001행 거부는 품목을 만들지 않는다');

-- ─────────────────────────────────────────────
-- 성공. 새 품목 생성, 기존 품목 조정, 수량 0인 새 품목
-- ─────────────────────────────────────────────
select is(
  pg_temp.impa('[
    {"row":2,"sku":"N-1","name":"  신품  ","unit":"ea","category":"부품","safety":5,"location":"L1","qty":10},
    {"row":3,"sku":"S-1","location":"L1","qty":7},
    {"row":4,"sku":"Z-1","name":"영수량","unit":"ea","location":"L2","qty":0}]', '  업로드1  '),
  'ok|2/2/0', '새 품목 2개를 만들고 2행을 조정한다');
select is(
  (select name || '|' || unit || '|' || category || '|' || safety_stock::text from public.stock_items where sku = 'N-1'),
  '신품|ea|부품|5.000', '새 품목의 이름·단위·카테고리·안전재고가 저장된다');
select is(
  (select string_agg(i.sku || ':' || m.qty::text || ':' || m.balance_after::text || ':' || m.total_after::text || ':' || m.note, ',' order by i.sku)
   from public.stock_movements m join public.stock_items i on i.id = m.item_id where m.kind = 'adjust'),
  'N-1:10.000:10.000:10.000:업로드1,S-1:7.000:7.000:7.000:업로드1', '조정 이력에 차이·잔량·합계와 trim된 메모가 남는다');
select is(
  (select count(*)::int from public.stock_items where sku = 'Z-1'), 1, '수량 0인 새 품목도 만들어진다');
select is(
  (select count(*)::int from public.stock_movements m join public.stock_items i on i.id = m.item_id where i.sku = 'Z-1'),
  0, '수량 0인 새 품목은 이력이 없다');
select is(
  (select created_by::text from public.stock_items where sku = 'N-1'),
  '00000000-0000-0000-0000-0000000022a1', '새 품목의 created_by는 호출자다');

-- ─────────────────────────────────────────────
-- 재업로드는 전부 건너뛴다
-- ─────────────────────────────────────────────
select is(
  pg_temp.impa('[
    {"row":2,"sku":"N-1","name":"신품","unit":"ea","category":"부품","safety":5,"location":"L1","qty":10},
    {"row":3,"sku":"S-1","location":"L1","qty":7},
    {"row":4,"sku":"Z-1","name":"영수량","unit":"ea","location":"L2","qty":0}]', '업로드2'),
  'ok|0/0/3', '같은 파일을 다시 올리면 모두 건너뛴다');
select is(
  (select count(*)::int from public.stock_movements), 2, '건너뜀은 이력을 만들지 않는다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","name":"무시","unit":"kg","category":"무시","safety":99,"location":"L1","qty":7}]', '업로드3'),
  'ok|0/0/1', '기존 품목의 이름·단위·카테고리·안전재고 열은 무시한다');
select is(
  (select name || '|' || unit || '|' || safety_stock::text from public.stock_items where sku = 'S-1'),
  '볼트|ea|0.000', '기존 품목 속성은 바뀌지 않는다');

-- ─────────────────────────────────────────────
-- 대소문자 무시와 여러 위치
-- ─────────────────────────────────────────────
select is(
  pg_temp.impa('[{"row":2,"sku":"s-1","location":"l1","qty":8}]', '업로드4'),
  'ok|0/1/0', 'SKU와 위치 이름은 대소문자를 무시하고 찾는다');
select is(
  (select qty::text from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000022c1' and location_id = '50000000-0000-0000-0000-0000000022d1'),
  '8.000', '수량이 8로 맞춰진다');
select is(
  pg_temp.impa('[
    {"row":3,"sku":"M-1","location":"L1","qty":2},
    {"row":2,"sku":"M-1","name":"다위치","unit":"kg","location":"L2","qty":1.5}]', '업로드5'),
  'ok|1/2/0', '같은 새 품목을 여러 위치에 올리면 품목은 한 번만 만든다');
select is(
  (select string_agg(m.total_after::text, ',' order by m.total_after) from public.stock_movements m join public.stock_items i on i.id = m.item_id where i.sku = 'M-1'),
  '1.500,3.500', '행 번호 순서로 처리해 합계가 누적된다');
select is(
  (select count(*)::int from public.stock_movements), 5, '여기까지 이력은 5건이다');

-- ─────────────────────────────────────────────
-- 오류 종류별 거부와 전체 롤백. 성공할 행(AA0, E-05 첫 행, S-1)도 같이 넣는다
-- ─────────────────────────────────────────────
select is(
  split_part(pg_temp.impa('[
    {"row":11,"sku":"S-1","location":"L1","qty":99},
    {"row":12,"sku":"AA0","name":"성공 행","unit":"ea","location":"L1","qty":3},
    {"row":2,"sku":"E-01","location":"없는위치","qty":1},
    {"row":3,"sku":"E-02","location":"LA","qty":1},
    {"row":4,"sku":"E-03","name":"x","unit":"ea","location":"L1","qty":-1},
    {"row":5,"sku":"E-04","name":"x","unit":"ea","location":"L1","qty":1.5555},
    {"row":6,"sku":"E-05","name":"중복","unit":"ea","location":"L1","qty":1},
    {"row":7,"sku":"e-05","location":"l1","qty":2},
    {"row":8,"sku":"E-06","unit":"ea","location":"L1","qty":1},
    {"row":9,"sku":"E-07","name":"단위없음","location":"L1","qty":1},
    {"row":10,"sku":"ARCH-1","location":"L1","qty":1}]', '실패'), '|', 1),
  'import_invalid', '오류가 있으면 import_invalid다');
select is(
  substr(pg_temp.impa('[
    {"row":11,"sku":"S-1","location":"L1","qty":99},
    {"row":12,"sku":"AA0","name":"성공 행","unit":"ea","location":"L1","qty":3},
    {"row":2,"sku":"E-01","location":"없는위치","qty":1},
    {"row":3,"sku":"E-02","location":"LA","qty":1},
    {"row":4,"sku":"E-03","name":"x","unit":"ea","location":"L1","qty":-1},
    {"row":5,"sku":"E-04","name":"x","unit":"ea","location":"L1","qty":1.5555},
    {"row":6,"sku":"E-05","name":"중복","unit":"ea","location":"L1","qty":1},
    {"row":7,"sku":"e-05","location":"l1","qty":2},
    {"row":8,"sku":"E-06","unit":"ea","location":"L1","qty":1},
    {"row":9,"sku":"E-07","name":"단위없음","location":"L1","qty":1},
    {"row":10,"sku":"ARCH-1","location":"L1","qty":1}]', '실패'), 16)::jsonb,
  '[{"row":10,"code":"archived"},{"row":2,"code":"location_not_found"},{"row":3,"code":"location_not_found"},
    {"row":4,"code":"invalid_qty"},{"row":5,"code":"invalid_qty"},{"row":7,"code":"duplicate_row"},
    {"row":8,"code":"name_required"},{"row":9,"code":"unit_required"}]'::jsonb,
  '오류 detail에 행 번호와 코드가 처리 순서대로 모인다');
select is(
  (select count(*)::int from public.stock_items where sku in ('AA0', 'E-05', 'E-06', 'E-07')), 0,
  '오류가 있으면 성공한 행의 새 품목도 만들어지지 않는다');
select is(
  (select qty::text from public.stock_levels where item_id = '40000000-0000-0000-0000-0000000022c1' and location_id = '50000000-0000-0000-0000-0000000022d1'),
  '8.000', '오류가 있으면 기존 수량이 그대로다');
select is(
  (select count(*)::int from public.stock_movements), 5, '오류가 있으면 이력이 늘지 않는다');

-- 오류 하나씩
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"없는위치","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "location_not_found"}]', '없는 위치는 location_not_found다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"LA","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "location_not_found"}]', '보관된 위치는 location_not_found다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"LB","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "location_not_found"}]', '다른 워크스페이스의 위치는 location_not_found다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":-1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "invalid_qty"}]', '음수 수량은 invalid_qty다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":"abc"}]', '메모'),
  'import_invalid|[{"row": 2, "code": "invalid_qty"}]', '숫자가 아닌 수량은 invalid_qty다');
select is(
  pg_temp.impa('[{"row":2,"sku":"S-1","location":"L1","qty":100000000000}]', '메모'),
  'import_invalid|[{"row": 2, "code": "invalid_qty"}]', '범위를 넘는 수량은 invalid_qty다');
select is(
  pg_temp.impa('[{"row":2,"sku":"  ","location":"L1","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "invalid_qty"}]', 'SKU가 비면 invalid_qty다');
select is(
  pg_temp.impa('[{"row":2,"sku":"N-2","name":"새","unit":"ea","safety":-1,"location":"L1","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "invalid_qty"}]', '새 품목의 음수 안전재고는 invalid_qty다');
select is(
  pg_temp.impa('[{"row":2,"sku":"N-2","name":"새","unit":"ea","location":"L1","qty":1},{"row":3,"sku":"N-2","location":"L1","qty":2}]', '메모'),
  'import_invalid|[{"row": 3, "code": "duplicate_row"}]', '같은 (SKU, 위치)의 두 번째 행은 duplicate_row다');
select is(
  pg_temp.impa('[{"row":2,"sku":"N-2","unit":"ea","location":"L1","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "name_required"}]', '새 품목에 이름이 없으면 name_required다');
select is(
  pg_temp.impa('[{"row":2,"sku":"N-2","name":"새","location":"L1","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "unit_required"}]', '새 품목에 단위가 없으면 unit_required다');
select is(
  pg_temp.impa('[{"row":2,"sku":"arch-1","location":"L1","qty":1}]', '메모'),
  'import_invalid|[{"row": 2, "code": "archived"}]', '보관된 품목은 archived다');
select is(
  (select count(*)::int from public.stock_items where sku = 'N-2'), 0, '거부된 호출은 품목을 만들지 않는다');

-- 오류가 100개를 넘으면 마지막에 truncated 한 개를 붙이고 멈춘다
select is(
  (substr(pg_temp.imp('10000000-0000-0000-0000-0000000022b1',
    (select jsonb_agg(jsonb_build_object('row', g + 1, 'sku', 'T' || lpad(g::text, 3, '0'), 'location', '없음', 'qty', 1)) from generate_series(1, 150) g),
    '메모'), 16)::jsonb -> 100 ->> 'code') || '|' ||
  jsonb_array_length(substr(pg_temp.imp('10000000-0000-0000-0000-0000000022b1',
    (select jsonb_agg(jsonb_build_object('row', g + 1, 'sku', 'T' || lpad(g::text, 3, '0'), 'location', '없음', 'qty', 1)) from generate_series(1, 150) g),
    '메모'), 16)::jsonb)::text,
  'truncated|101', '오류 100개 뒤에 truncated 표지를 붙인다');

-- ─────────────────────────────────────────────
-- 안전재고 알림(c3, 안전재고 10, L1 수량 20). 기준 아래로 처음 내려갈 때만 1회
-- ─────────────────────────────────────────────
select is(
  pg_temp.impa('[{"row":2,"sku":"ALERT-1","location":"L1","qty":5}]', '실사'),
  'ok|0/1/0', '합계를 5로 맞춘다');
select is(
  (select count(*)::int from public.notifications where type = 'stock' and stock_item_id = '40000000-0000-0000-0000-0000000022c3'),
  1, '기준 아래로 내려가면 owner가 알림을 1건 받는다');
select is(
  pg_temp.impa('[{"row":2,"sku":"ALERT-1","location":"L1","qty":3}]', '실사'),
  'ok|0/1/0', '이미 기준 아래에서 더 줄인다');
select is(
  (select count(*)::int from public.notifications where type = 'stock' and stock_item_id = '40000000-0000-0000-0000-0000000022c3'),
  1, '이미 기준 아래이면 알림을 더 만들지 않는다');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000022a2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.notifications where type = 'stock' and stock_item_id = '40000000-0000-0000-0000-0000000022c3'),
  1, 'admin도 1건 받는다');
select is(
  pg_temp.impa('[{"row":2,"sku":"ALERT-1","location":"L1","qty":12}]', '실사'),
  'ok|0/1/0', 'admin이 업로드할 수 있다(기준 위로 회복)');
select is(
  (select m.note || '|' || m.qty::text || '|' || m.created_by::text from public.stock_movements m
   where m.item_id = '40000000-0000-0000-0000-0000000022c3' order by m.qty desc limit 1),
  '실사|9.000|00000000-0000-0000-0000-0000000022a2', '이력 created_by는 호출자다');
select is(
  (select count(*)::int from public.notifications where type = 'stock' and stock_item_id = '40000000-0000-0000-0000-0000000022c3'),
  1, '기준 위로 회복해도 알림은 늘지 않는다');

-- ─────────────────────────────────────────────
-- anon은 함수를 실행할 수 없다
-- ─────────────────────────────────────────────
reset role;
set local role anon;
select throws_ok(
  $$select public.stock_import('10000000-0000-0000-0000-0000000022b1', '[{"row":2,"sku":"S-1","location":"L1","qty":1}]'::jsonb, '메모')$$,
  '42501', null, 'anon은 stock_import를 실행할 수 없다');

select * from finish();
rollback;
