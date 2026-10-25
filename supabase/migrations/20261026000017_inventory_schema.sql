-- 재고 관리 스키마. 품목·위치·위치별 수량·추가만 가능한 이력과 읽기 정책, 이력 불변 트리거를 만든다.
-- 쓰기는 클라이언트에 열지 않는다. 다음 마이그레이션(inventory_rpc)의 definer RPC만 쓴다.

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  sku text not null check (char_length(btrim(sku)) between 1 and 64),
  unit text not null check (char_length(btrim(unit)) between 1 and 16),
  category text check (category is null or char_length(btrim(category)) between 1 and 64),
  safety_stock numeric(14, 3) not null default 0 check (safety_stock >= 0),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 하위 테이블이 같은 워크스페이스의 품목만 가리키게 하는 복합 FK 대상
  unique (id, workspace_id)
);
-- 보관된 품목도 SKU를 점유한다. 대소문자는 구분하지 않는다.
create unique index stock_items_ws_sku_key on public.stock_items (workspace_id, lower(sku));
create index stock_items_created_by_idx on public.stock_items (created_by);

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index stock_locations_ws_name_key on public.stock_locations (workspace_id, lower(name));

create table public.stock_levels (
  item_id uuid not null,
  location_id uuid not null,
  workspace_id uuid not null,
  qty numeric(14, 3) not null check (qty >= 0),
  primary key (item_id, location_id),
  foreign key (item_id, workspace_id) references public.stock_items (id, workspace_id) on delete cascade,
  foreign key (location_id, workspace_id) references public.stock_locations (id, workspace_id) on delete cascade
);
create index stock_levels_location_id_idx on public.stock_levels (location_id);
create index stock_levels_workspace_id_idx on public.stock_levels (workspace_id);

-- 이력. location_id는 입고·출고·조정 위치이고 이동에서는 출발 위치다. to_location_id는 이동 도착만 쓴다.
-- balance_after는 location_id 위치의 변경 후 수량, total_after는 품목 합계의 변경 후 값이다.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  item_id uuid not null,
  kind text not null check (kind in ('in', 'out', 'transfer', 'adjust')),
  location_id uuid not null,
  to_location_id uuid,
  qty numeric(14, 3) not null,
  balance_after numeric(14, 3) not null,
  total_after numeric(14, 3) not null,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'transfer' and to_location_id is not null and to_location_id <> location_id)
    or (kind <> 'transfer' and to_location_id is null)),
  check (
    (kind in ('in', 'out', 'transfer') and qty > 0)
    or (kind = 'adjust' and qty <> 0)),
  foreign key (item_id, workspace_id) references public.stock_items (id, workspace_id) on delete cascade,
  foreign key (location_id, workspace_id) references public.stock_locations (id, workspace_id) on delete cascade,
  -- to_location_id가 null이면 복합 FK는 검사하지 않는다
  foreign key (to_location_id, workspace_id) references public.stock_locations (id, workspace_id) on delete cascade
);
create index stock_movements_item_created_idx on public.stock_movements (item_id, created_at desc);
create index stock_movements_workspace_id_idx on public.stock_movements (workspace_id);
create index stock_movements_location_id_idx on public.stock_movements (location_id);
create index stock_movements_to_location_id_idx on public.stock_movements (to_location_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

-- 알림에서 품목으로 가는 링크. task_id·project_id가 모두 null이어도 기존 check를 통과한다.
alter table public.notifications
  add column stock_item_id uuid references public.stock_items (id) on delete cascade;
create index notifications_stock_item_id_idx on public.notifications (stock_item_id);

create trigger stock_items_updated_at before update on public.stock_items
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- 이력 불변. definer 경로와 postgres 권한도 막는다.
-- 예외는 FK 동작(워크스페이스·품목·위치 삭제 cascade, 사용자 삭제 시 created_by 비우기)으로 들어온 경우뿐이다.
-- 그 경우 트리거는 RI 트리거 안에서 돌아 깊이가 2 이상이다. 직접 update·delete는 깊이 1이라 막힌다.
-- ─────────────────────────────────────────────
create function public.guard_stock_movement_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  raise exception using errcode = 'P0001', message = 'immutable';
end;
$$;
revoke execute on function public.guard_stock_movement_immutable() from public, anon, authenticated;

create trigger stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function public.guard_stock_movement_immutable();

-- ─────────────────────────────────────────────
-- 권한 판정. owner·admin·member만 재고를 본다(guest·비소속 제외)
-- ─────────────────────────────────────────────
create function private.can_use_stock(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.ws_role(p_ws) in ('owner', 'admin', 'member'), false);
$$;
revoke execute on function private.can_use_stock(uuid) from public, anon;
grant execute on function private.can_use_stock(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RLS. 읽기 정책만 두고 쓰기 권한은 거둔다.
-- ─────────────────────────────────────────────
alter table public.stock_items enable row level security;
alter table public.stock_locations enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;

create policy stock_items_select on public.stock_items for select to authenticated
  using (private.can_use_stock(workspace_id));
create policy stock_locations_select on public.stock_locations for select to authenticated
  using (private.can_use_stock(workspace_id));
create policy stock_levels_select on public.stock_levels for select to authenticated
  using (private.can_use_stock(workspace_id));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (private.can_use_stock(workspace_id));

revoke insert, update, delete on
  public.stock_items, public.stock_locations, public.stock_levels, public.stock_movements
from authenticated;
revoke all on
  public.stock_items, public.stock_locations, public.stock_levels, public.stock_movements
from anon;
