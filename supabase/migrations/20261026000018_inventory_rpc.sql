-- 재고 관리 RPC. 품목·위치 관리와 입고·출고·이동·조정, 안전재고 알림(private.notify_stock)을 만든다.
-- 쓰기 경로는 전부 definer RPC다. 함수마다 auth.uid()와 대상 행의 워크스페이스 역할을 직접 확인한다.
-- 권한 표기. A는 owner·admin, M은 owner·admin·member다. 비소속·guest는 forbidden이다.

-- ─────────────────────────────────────────────
-- 내부 함수. definer RPC 안에서만 부르고 클라이언트 역할은 실행할 수 없다.
-- ─────────────────────────────────────────────

-- 현재 사용자의 워크스페이스 역할을 확인한다. p_admin이면 owner·admin만 통과한다.
create function private.stock_require_role(p_ws uuid, p_admin boolean)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role public.ws_role := public.ws_role(p_ws);
begin
  if v_role is null or v_role = 'guest' or (p_admin and v_role not in ('owner', 'admin')) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
end;
$$;

-- 입력 텍스트를 trim한다. 비었거나 최대 길이를 넘으면 invalid_qty다.
-- p_opt가 true면 빈 값은 null로 돌려준다(카테고리용).
create function private.stock_text(p_v text, p_max int, p_opt boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_t text := btrim(p_v);
begin
  if p_opt and (v_t is null or v_t = '') then
    return null;
  end if;
  if v_t is null or v_t = '' or char_length(v_t) > p_max then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  return v_t;
end;
$$;

-- 수량 인자를 검사한다. 소수 3자리와 numeric(14,3) 범위를 넘으면 invalid_qty다.
-- p_zero가 true면 0을 허용한다(안전재고·조정 목표용). 아니면 0 초과여야 한다.
create function private.stock_check_qty(p_q numeric, p_zero boolean)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_q is null or p_q < 0 or (p_q = 0 and not p_zero)
     or p_q >= 100000000000 or round(p_q, 3) <> p_q then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  return p_q;
end;
$$;

-- 품목을 찾아 권한을 확인한 뒤 행을 잠가 돌려준다. 같은 품목의 수량 변경을 직렬화한다.
-- 권한은 잠그기 전에 보므로 권한 없는 호출이 잠금을 쥐지 않는다.
create function private.stock_lock_item(p_item uuid, p_admin boolean)
returns public.stock_items
language plpgsql
set search_path = ''
as $$
declare
  v_ws uuid;
  v_item public.stock_items;
begin
  select i.workspace_id into v_ws from public.stock_items i where i.id = p_item;
  if v_ws is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  perform private.stock_require_role(v_ws, p_admin);
  select * into v_item from public.stock_items i where i.id = p_item for update;
  return v_item;
end;
$$;

-- 같은 워크스페이스의 위치를 공유 잠금으로 읽는다. 보관 중이면 archived다.
-- 위치 보관(update 잠금)과 수량 변경이 엇갈려 수량이 있는 위치가 보관되는 일을 막는다.
create function private.stock_lock_location(p_loc uuid, p_ws uuid)
returns public.stock_locations
language plpgsql
set search_path = ''
as $$
declare
  v_loc public.stock_locations;
begin
  select * into v_loc from public.stock_locations l
  where l.id = p_loc and l.workspace_id = p_ws for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_loc.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'archived';
  end if;
  return v_loc;
end;
$$;

-- 품목 합계(모든 위치 수량의 합)
create function private.stock_total(p_item uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(l.qty), 0) from public.stock_levels l where l.item_id = p_item;
$$;

-- 위치 한 곳의 수량을 바꾸고 변경 후 수량을 돌려준다(행이 없으면 만든다).
-- upsert를 쓰지 않는다. 음수 증감은 insert 값의 check가 충돌 처리보다 먼저 걸린다.
-- 호출자가 품목 행을 잠근 뒤에만 부르므로 update와 insert 사이에 다른 요청이 끼지 않는다.
create function private.stock_apply(p_item public.stock_items, p_loc uuid, p_delta numeric)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_qty numeric;
begin
  update public.stock_levels l set qty = l.qty + p_delta
  where l.item_id = p_item.id and l.location_id = p_loc
  returning l.qty into v_qty;
  if not found then
    insert into public.stock_levels (item_id, location_id, workspace_id, qty)
    values (p_item.id, p_loc, p_item.workspace_id, p_delta)
    returning qty into v_qty;
  end if;
  return v_qty;
end;
$$;

-- 알림 한 건씩을 워크스페이스 owner·admin 전원에게 만든다. 알림 설정에서 stock을 끈 사람은 건너뛴다.
-- 기존 private.notify는 프로젝트 권한으로 수신자를 거르므로 재고 알림은 이 함수를 따로 쓴다.
-- p_text는 품목 이름이고 p_snippet은 '합계 / 안전재고' 문자열이다.
create function private.notify_stock(p_ws uuid, p_item uuid, p_text text, p_snippet text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, workspace_id, type, actor_id, stock_item_id, text, snippet)
  select m.user_id, p_ws, 'stock', auth.uid(), p_item, p_text, p_snippet
  from public.workspace_members m
  where m.workspace_id = p_ws and m.status = 'active' and m.role in ('owner', 'admin')
    and not exists (
      select 1 from public.user_prefs up
      where up.user_id = m.user_id and up.workspace_id = p_ws
        and up.notif_prefs ->> 'stock' = 'false'
    );
end;
$$;

-- 합계가 안전재고 아래로 처음 내려갈 때만 알린다. 이동은 합계가 같아 여기서 걸리지 않는다.
create function private.stock_check_low(p_item public.stock_items, p_before numeric, p_after numeric)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_item.safety_stock > 0 and p_before >= p_item.safety_stock and p_after < p_item.safety_stock then
    perform private.notify_stock(p_item.workspace_id, p_item.id, p_item.name,
                                 trim_scale(p_after)::text || ' / ' || trim_scale(p_item.safety_stock)::text);
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 품목·위치 관리(A)
-- ─────────────────────────────────────────────
create function public.stock_create_item(
  p_ws uuid, p_name text, p_sku text, p_unit text, p_category text, p_safety numeric
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_items;
begin
  perform private.require_uid();
  perform private.stock_require_role(p_ws, true);
  insert into public.stock_items (workspace_id, name, sku, unit, category, safety_stock, created_by)
  values (p_ws, private.stock_text(p_name, 100), private.stock_text(p_sku, 64), private.stock_text(p_unit, 16),
          private.stock_text(p_category, 64, true), private.stock_check_qty(coalesce(p_safety, 0), true),
          auth.uid())
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'duplicate_sku';
end;
$$;

create function public.stock_update_item(
  p_item uuid, p_name text, p_sku text, p_unit text, p_category text, p_safety numeric
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_items;
begin
  perform private.require_uid();
  perform private.stock_lock_item(p_item, true);
  update public.stock_items i
  set name = private.stock_text(p_name, 100), sku = private.stock_text(p_sku, 64),
      unit = private.stock_text(p_unit, 16), category = private.stock_text(p_category, 64, true),
      safety_stock = private.stock_check_qty(coalesce(p_safety, 0), true)
  where i.id = p_item
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'duplicate_sku';
end;
$$;

create function public.stock_set_item_archived(p_item uuid, p_archived boolean)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_items;
begin
  perform private.require_uid();
  perform private.stock_lock_item(p_item, true);
  if p_archived is null then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  update public.stock_items i
  set archived_at = case when p_archived then coalesce(i.archived_at, now()) else null end
  where i.id = p_item
  returning * into v_row;
  return v_row;
end;
$$;

create function public.stock_create_location(p_ws uuid, p_name text)
returns public.stock_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_locations;
begin
  perform private.require_uid();
  perform private.stock_require_role(p_ws, true);
  insert into public.stock_locations (workspace_id, name)
  values (p_ws, private.stock_text(p_name, 100))
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'duplicate_name';
end;
$$;

-- 위치를 찾아 A 권한을 확인하고 행을 잠가 돌려준다(위치 RPC 두 개가 같이 쓴다)
create function private.stock_lock_location_admin(p_loc uuid)
returns public.stock_locations
language plpgsql
set search_path = ''
as $$
declare
  v_ws uuid;
  v_loc public.stock_locations;
begin
  select l.workspace_id into v_ws from public.stock_locations l where l.id = p_loc;
  if v_ws is null then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  perform private.stock_require_role(v_ws, true);
  select * into v_loc from public.stock_locations l where l.id = p_loc for update;
  return v_loc;
end;
$$;

create function public.stock_rename_location(p_location uuid, p_name text)
returns public.stock_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_locations;
begin
  perform private.require_uid();
  perform private.stock_lock_location_admin(p_location);
  update public.stock_locations l set name = private.stock_text(p_name, 100)
  where l.id = p_location
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception using errcode = 'P0001', message = 'duplicate_name';
end;
$$;

create function public.stock_set_location_archived(p_location uuid, p_archived boolean)
returns public.stock_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_locations;
begin
  perform private.require_uid();
  perform private.stock_lock_location_admin(p_location);
  if p_archived is null then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  if p_archived and exists (
    select 1 from public.stock_levels sl where sl.location_id = p_location and sl.qty > 0
  ) then
    raise exception using errcode = 'P0001', message = 'location_not_empty';
  end if;
  update public.stock_locations l
  set archived_at = case when p_archived then coalesce(l.archived_at, now()) else null end
  where l.id = p_location
  returning * into v_row;
  return v_row;
end;
$$;

-- ─────────────────────────────────────────────
-- 수량 변경. 공통 절차는 권한 → 품목 잠금 → 변경 전 합계 → 수량 반영 → 이력 → 알림 판정이다.
-- ─────────────────────────────────────────────

-- 입고(M)
create function public.stock_receive(p_item uuid, p_location uuid, p_qty numeric, p_note text default null)
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
  v_before := private.stock_total(p_item);
  v_bal := private.stock_apply(v_item, p_location, p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'in', p_location, p_qty, v_bal, v_before + p_qty, left(p_note, 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before + p_qty);
  return v_mv;
end;
$$;

-- 출고(M). 결과가 음수면 insufficient_stock이다.
create function public.stock_issue(p_item uuid, p_location uuid, p_qty numeric, p_note text default null)
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
  v_before := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_location;
  if v_cur < p_qty then
    raise exception using errcode = 'P0001', message = 'insufficient_stock';
  end if;
  v_bal := private.stock_apply(v_item, p_location, -p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'out', p_location, p_qty, v_bal, v_before - p_qty, left(p_note, 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before - p_qty);
  return v_mv;
end;
$$;

-- 이동(M). 합계가 변하지 않아 알림 판정을 하지 않는다.
create function public.stock_transfer(p_item uuid, p_from uuid, p_to uuid, p_qty numeric, p_note text default null)
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
  v_total := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_from;
  if v_cur < p_qty then
    raise exception using errcode = 'P0001', message = 'insufficient_stock';
  end if;
  v_bal := private.stock_apply(v_item, p_from, -p_qty);
  perform private.stock_apply(v_item, p_to, p_qty);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, to_location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'transfer', p_from, p_to, p_qty, v_bal, v_total, left(p_note, 500), auth.uid())
  returning * into v_mv;
  return v_mv;
end;
$$;

-- 조정(A만). 위치 수량을 목표 값으로 맞추고 이력 qty에는 목표 - 현재(부호 있음)를 남긴다.
create function public.stock_adjust(p_item uuid, p_location uuid, p_target numeric, p_note text default null)
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
  v_before := private.stock_total(p_item);
  select coalesce(sum(l.qty), 0) into v_cur from public.stock_levels l
  where l.item_id = p_item and l.location_id = p_location;
  if p_target = v_cur then
    raise exception using errcode = 'P0001', message = 'invalid_qty';
  end if;
  perform private.stock_apply(v_item, p_location, p_target - v_cur);
  insert into public.stock_movements (workspace_id, item_id, kind, location_id, qty, balance_after, total_after, note, created_by)
  values (v_item.workspace_id, p_item, 'adjust', p_location, p_target - v_cur, p_target,
          v_before + (p_target - v_cur), left(p_note, 500), auth.uid())
  returning * into v_mv;
  perform private.stock_check_low(v_item, v_before, v_before + (p_target - v_cur));
  return v_mv;
end;
$$;

-- ─────────────────────────────────────────────
-- 실행 권한
-- ─────────────────────────────────────────────
revoke execute on function
  private.stock_require_role(uuid, boolean),
  private.stock_text(text, int, boolean),
  private.stock_check_qty(numeric, boolean),
  private.stock_lock_item(uuid, boolean),
  private.stock_lock_location(uuid, uuid),
  private.stock_lock_location_admin(uuid),
  private.stock_total(uuid),
  private.stock_apply(public.stock_items, uuid, numeric),
  private.notify_stock(uuid, uuid, text, text),
  private.stock_check_low(public.stock_items, numeric, numeric)
from public, anon, authenticated;

revoke execute on function
  public.stock_create_item(uuid, text, text, text, text, numeric),
  public.stock_update_item(uuid, text, text, text, text, numeric),
  public.stock_set_item_archived(uuid, boolean),
  public.stock_create_location(uuid, text),
  public.stock_rename_location(uuid, text),
  public.stock_set_location_archived(uuid, boolean),
  public.stock_receive(uuid, uuid, numeric, text),
  public.stock_issue(uuid, uuid, numeric, text),
  public.stock_transfer(uuid, uuid, uuid, numeric, text),
  public.stock_adjust(uuid, uuid, numeric, text)
from public, anon;

grant execute on function
  public.stock_create_item(uuid, text, text, text, text, numeric),
  public.stock_update_item(uuid, text, text, text, text, numeric),
  public.stock_set_item_archived(uuid, boolean),
  public.stock_create_location(uuid, text),
  public.stock_rename_location(uuid, text),
  public.stock_set_location_archived(uuid, boolean),
  public.stock_receive(uuid, uuid, numeric, text),
  public.stock_issue(uuid, uuid, numeric, text),
  public.stock_transfer(uuid, uuid, uuid, numeric, text),
  public.stock_adjust(uuid, uuid, numeric, text)
to authenticated;
