-- 재고 변경 4종(입고·출고·이동·조정)의 메모를 필수로 강제한다. 비어 있으면 note_required로 거부한다.

-- 메모를 trim해 돌려주고, null이거나 비어 있으면 note_required를 던진다.
create function private.stock_note(p_note text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_t text := btrim(p_note);
begin
  if v_t is null or v_t = '' then
    raise exception using errcode = 'P0001', message = 'note_required';
  end if;
  return v_t;
end;
$$;

revoke execute on function private.stock_note(text) from public, anon, authenticated;

-- 아래 4개 함수는 018의 정의에서 메모 검증(private.stock_note)만 더했다. 시그니처와 권한은 그대로다.
-- 입고(M)
create or replace function public.stock_receive(p_item uuid, p_location uuid, p_qty numeric, p_note text default null)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_before numeric;
  v_bal numeric;
  v_mv public.stock_movements;
begin
  perform private.require_uid();
  perform private.stock_check_qty(p_qty, false);
  v_item := private.stock_lock_item(p_item, false);
  if v_item.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'archived';
  end if;
  perform private.stock_lock_location(p_location, v_item.workspace_id);
  perform private.stock_note(p_note);
  v_before := private.stock_total(p_item);
  v_bal := private.stock_apply(v_item, p_location, p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'in', p_location, p_qty, v_bal, v_before + p_qty, left(private.stock_note(p_note), 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before + p_qty);
  return v_mv;
end;
$$;

-- 출고(M). 결과가 음수면 insufficient_stock이다.
create or replace function public.stock_issue(p_item uuid, p_location uuid, p_qty numeric, p_note text default null)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_before numeric;
  v_cur numeric;
  v_bal numeric;
  v_mv public.stock_movements;
begin
  perform private.require_uid();
  perform private.stock_check_qty(p_qty, false);
  v_item := private.stock_lock_item(p_item, false);
  if v_item.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'archived';
  end if;
  perform private.stock_lock_location(p_location, v_item.workspace_id);
  perform private.stock_note(p_note);
  v_before := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_location;
  if v_cur < p_qty then
    raise exception using errcode = 'P0001', message = 'insufficient_stock';
  end if;
  v_bal := private.stock_apply(v_item, p_location, -p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'out', p_location, p_qty, v_bal, v_before - p_qty, left(private.stock_note(p_note), 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before - p_qty);
  return v_mv;
end;
$$;

-- 이동(M). 합계가 변하지 않아 알림 판정을 하지 않는다.
create or replace function public.stock_transfer(p_item uuid, p_from uuid, p_to uuid, p_qty numeric, p_note text default null)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_total numeric;
  v_cur numeric;
  v_bal numeric;
  v_mv public.stock_movements;
begin
  perform private.require_uid();
  perform private.stock_check_qty(p_qty, false);
  v_item := private.stock_lock_item(p_item, false);
  if p_from = p_to then
    raise exception using errcode = 'P0001', message = 'same_location';
  end if;
  if v_item.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'archived';
  end if;
  perform private.stock_lock_location(p_from, v_item.workspace_id);
  perform private.stock_lock_location(p_to, v_item.workspace_id);
  perform private.stock_note(p_note);
  v_total := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_from;
  if v_cur < p_qty then
    raise exception using errcode = 'P0001', message = 'insufficient_stock';
  end if;
  v_bal := private.stock_apply(v_item, p_from, -p_qty);
  perform private.stock_apply(v_item, p_to, p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, to_location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'transfer', p_from, p_to, p_qty, v_bal, v_total, left(private.stock_note(p_note), 500), auth.uid())
  returning * into v_mv;
  return v_mv;
end;
$$;

-- 조정(A만). 위치 수량을 목표 값으로 맞추고 이력 qty에는 목표 - 현재(부호 있음)를 남긴다.
create or replace function public.stock_adjust(p_item uuid, p_location uuid, p_target numeric, p_note text default null)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_before numeric;
  v_cur numeric;
  v_mv public.stock_movements;
begin
  perform private.require_uid();
  perform private.stock_check_qty(p_target, true);
  v_item := private.stock_lock_item(p_item, true);
  if v_item.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'archived';
  end if;
  perform private.stock_lock_location(p_location, v_item.workspace_id);
  perform private.stock_note(p_note);
  v_before := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_location;
  if p_target = v_cur then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  perform private.stock_apply(v_item, p_location, p_target - v_cur);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'adjust', p_location, p_target - v_cur, p_target,
          v_before + (p_target - v_cur), left(private.stock_note(p_note), 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before + (p_target - v_cur));
  return v_mv;
end;
$$;
