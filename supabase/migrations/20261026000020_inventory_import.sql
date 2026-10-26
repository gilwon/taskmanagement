-- 재고 엑셀 업로드 RPC. 행 목록(JSON)을 SKU·위치 기준으로 실사 수량에 맞추고, 한 행이라도 오류면 전체를 롤백한다.
-- 권한은 A(owner·admin)만이다. 행마다 서브 트랜잭션으로 오류를 모으고 마지막에 한꺼번에 import_invalid로 알린다.

-- p_rows 원소 형식은 {row, sku, name, unit, category, safety, location, qty}다. row는 엑셀 행 번호다.
-- 오류는 import_invalid의 detail에 [{"row":n,"code":"..."}] 문자열로 담는다. 100개를 넘으면 {"row":0,"code":"truncated"}로 끊는다.
-- 성공하면 {created, adjusted, skipped}를 돌려준다. 새 품목의 첫 수량이 0이면 created에만 센다.
create function public.stock_import(p_ws uuid, p_rows jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
  v_r record;
  v_errs jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
  v_created int := 0;
  v_adjusted int := 0;
  v_skipped int := 0;
  -- 행 하나 처리에 쓰는 변수
  v_sku text;
  v_key text;
  v_loc uuid;
  v_qty numeric;
  v_safety numeric;
  v_item public.stock_items;
  v_item_id uuid;
  v_new boolean;
  v_before numeric;
  v_cur numeric;
  v_code text;
  v_state text;
  v_c int;
  v_a int;
  v_s int;
begin
  perform private.require_uid();
  perform private.stock_require_role(p_ws, true);
  v_note := private.stock_note(p_note);

  -- 배열이 아니거나 1~1000개가 아니거나 row가 정수가 아닌 원소가 있으면 형식 오류다.
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) not between 1 and 1000
     or exists (
       select 1 from jsonb_array_elements(p_rows) e
       where jsonb_typeof(e.value) <> 'object'
          or jsonb_typeof(e.value -> 'row') is distinct from 'number'
          or (e.value ->> 'row') !~ '^[0-9]{1,9}$'
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_import';
  end if;

  -- 처리 순서를 lower(sku), row 순으로 고정해 동시에 올리는 업로드끼리 품목 잠금 순서가 같게 한다.
  for v_r in
    select (e.value ->> 'row')::int as rown, e.value as j
    from jsonb_array_elements(p_rows) e
    order by lower(btrim(e.value ->> 'sku')), (e.value ->> 'row')::int
  loop
    begin
      v_c := 0; v_a := 0; v_s := 0; v_new := false;

      v_sku := private.stock_text(v_r.j ->> 'sku', 64);

      -- 위치는 보관되지 않은 것만 이름(대소문자 무시)으로 찾는다.
      select l.id into v_loc from public.stock_locations l
      where l.workspace_id = p_ws and lower(l.name) = lower(btrim(v_r.j ->> 'location')) and l.archived_at is null;
      if v_loc is null then
        raise exception using errcode = 'P0001', message = 'location_not_found';
      end if;
      perform private.stock_lock_location(v_loc, p_ws);

      -- 같은 (sku, 위치)의 두 번째 행부터는 중복이다.
      v_key := lower(v_sku) || '|' || v_loc::text;
      if v_key = any (v_seen) then
        raise exception using errcode = 'P0001', message = 'duplicate_row';
      end if;
      v_seen := v_seen || v_key;

      -- 수량은 숫자거나 10진 숫자 문자열이어야 하고 0을 허용한다. 앱은 부동소수 오차를 피하려고 문자열로 보낸다.
      if jsonb_typeof(v_r.j -> 'qty') not in ('number', 'string')
         or (v_r.j ->> 'qty') !~ '^[0-9]{1,14}(\.[0-9]{1,6})?$' then
        raise exception using errcode = 'P0001', message = 'invalid_qty';
      end if;
      v_qty := private.stock_check_qty((v_r.j ->> 'qty')::numeric, true);

      select i.id into v_item_id from public.stock_items i
      where i.workspace_id = p_ws and lower(i.sku) = lower(v_sku);

      if v_item_id is not null then
        v_item := private.stock_lock_item(v_item_id, true);
        if v_item.archived_at is not null then
          raise exception using errcode = 'P0001', message = 'archived';
        end if;
      else
        -- 새 품목. 이름·단위는 필수고 카테고리·안전재고는 이때만 쓴다.
        if btrim(coalesce(v_r.j ->> 'name', '')) = '' then
          raise exception using errcode = 'P0001', message = 'name_required';
        end if;
        if btrim(coalesce(v_r.j ->> 'unit', '')) = '' then
          raise exception using errcode = 'P0001', message = 'unit_required';
        end if;
        if v_r.j -> 'safety' is null or jsonb_typeof(v_r.j -> 'safety') = 'null' then
          v_safety := 0;
        elsif jsonb_typeof(v_r.j -> 'safety') = 'number' then
          v_safety := (v_r.j -> 'safety')::numeric;
        else
          raise exception using errcode = 'P0001', message = 'invalid_qty';
        end if;
        insert into public.stock_items (workspace_id, name, sku, unit, category, safety_stock, created_by)
        values (p_ws, private.stock_text(v_r.j ->> 'name', 100), v_sku, private.stock_text(v_r.j ->> 'unit', 16),
                private.stock_text(v_r.j ->> 'category', 64, true), private.stock_check_qty(v_safety, true),
                auth.uid())
        returning * into v_item;
        v_new := true;
        v_c := 1;
      end if;

      v_before := private.stock_total(v_item.id);
      select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
      where l.item_id = v_item.id and l.location_id = v_loc;

      if v_qty = v_cur then
        -- 같은 값이면 건너뛴다. 새 품목의 0은 품목만 만든 것이라 건너뜀으로 세지 않는다.
        if not v_new then
          v_s := 1;
        end if;
      else
        perform private.stock_apply(v_item, v_loc, v_qty - v_cur);
        insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
        values (p_ws, v_item.id, 'adjust', v_loc, v_qty - v_cur, v_qty, v_before + (v_qty - v_cur), left(v_note, 500), auth.uid());
        perform private.stock_check_low(v_item, v_before, v_before + (v_qty - v_cur));
        v_a := 1;
      end if;

      -- 카운터는 행이 끝까지 성공한 뒤에만 올린다. 서브 블록 롤백은 변수를 되돌리지 않는다.
      v_created := v_created + v_c;
      v_adjusted := v_adjusted + v_a;
      v_skipped := v_skipped + v_s;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_code = message_text;
      if v_state = '23505' then
        v_code := 'duplicate_sku';
      elsif v_state <> 'P0001' then
        -- 예상 못한 오류는 모으지 않고 그대로 다시 던진다.
        raise;
      end if;
      if jsonb_array_length(v_errs) >= 100 then
        v_errs := v_errs || jsonb_build_object('row', 0, 'code', 'truncated');
        exit;
      end if;
      v_errs := v_errs || jsonb_build_object('row', v_r.rown, 'code', v_code);
    end;
  end loop;

  if jsonb_array_length(v_errs) > 0 then
    raise exception using errcode = 'P0001', message = 'import_invalid', detail = v_errs::text;
  end if;
  return jsonb_build_object('created', v_created, 'adjusted', v_adjusted, 'skipped', v_skipped);
end;
$$;

-- 실행 권한. 018의 public RPC와 같이 anon·public은 막고 authenticated만 허용한다.
revoke execute on function public.stock_import(uuid, jsonb, text) from public, anon;
grant execute on function public.stock_import(uuid, jsonb, text) to authenticated;
