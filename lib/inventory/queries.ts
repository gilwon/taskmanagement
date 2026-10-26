// 재고 조회. 품목 목록(위치별 수량·합계·상태), 위치, 카테고리, 품목 상세(수량·이동 이력)를 RLS가 걸린 세션 클라이언트로 읽는다
import "server-only";
import { stockErrorMessage } from "@/lib/inventory/errors";
import { historyRange, stockStatus, sumLevels, type HistoryFilter } from "@/lib/inventory/rules";
import type { StockItem, StockItemRow, StockLevel, StockLocation, StockMovement, StockMovementKind } from "@/lib/inventory/types";
import { NAMELESS_MEMBER_LABEL } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// shortcut: 품목은 이름순 500건, 이력은 최신 100건까지만 읽는다. 필터·검색을 TS에서 하므로 넘는 워크스페이스가 생기면 서버 검색·페이지네이션으로 바꾼다
const ITEM_LIMIT = 500;
const MOVEMENT_LIMIT = 100;

const ITEM_COLUMNS = "id, name, sku, unit, category, safety_stock, archived_at";

type RawItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  safety_stock: number | string;
  archived_at: string | null;
};
type RawLevel = { item_id: string; location_id: string; qty: number | string };

function toStockItem(r: RawItem): StockItem {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    unit: r.unit,
    category: r.category,
    // numeric은 문자열로 올 수 있어 Number로 맞춘다
    safetyStock: Number(r.safety_stock),
    archived: r.archived_at !== null,
  };
}

function toStockLevel(r: RawLevel): StockLevel {
  return { itemId: r.item_id, locationId: r.location_id, qty: Number(r.qty) };
}

// 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
async function fail(what: string, error: { code?: string; message: string }): Promise<never> {
  console.error(`[${what}]`, error.code, error.message);
  throw new Error(stockErrorMessage(error, await getT()));
}

export async function getStockItems(
  workspaceId: string,
  opts: { q?: string; category?: string; low?: boolean; archived?: boolean } = {},
): Promise<StockItemRow[]> {
  const supabase = await createClient();
  const query = supabase
    .from("stock_items")
    .select(`${ITEM_COLUMNS}, stock_levels(item_id, location_id, qty)`)
    .eq("workspace_id", workspaceId);
  const { data, error } = await (opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null))
    .order("name")
    .order("id")
    .limit(ITEM_LIMIT);
  if (error) return fail("재고 품목", error);

  const q = opts.q?.trim().toLowerCase();
  const rows: StockItemRow[] = [];
  for (const r of data) {
    const item = toStockItem(r);
    if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) continue;
    if (opts.category && item.category !== opts.category) continue;
    const levels = r.stock_levels.map(toStockLevel);
    const total = sumLevels(levels);
    const status = stockStatus(total, item.safetyStock);
    if (opts.low && status === "ok") continue;
    rows.push({ ...item, total, levels, status });
  }
  return rows;
}

export async function getStockLocations(
  workspaceId: string,
  opts: { archived?: boolean } = {},
): Promise<StockLocation[]> {
  const supabase = await createClient();
  const query = supabase.from("stock_locations").select("id, name, archived_at").eq("workspace_id", workspaceId);
  const { data, error } = await (opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null))
    .order("name")
    .order("id");
  if (error) return fail("재고 위치", error);
  return data.map((l) => ({ id: l.id, name: l.name, archived: l.archived_at !== null }));
}

export async function getStockItemDetail(
  itemId: string,
  workspaceId: string,
  history: HistoryFilter = {},
): Promise<{ item: StockItem; levels: StockLevel[]; movements: StockMovement[] } | null> {
  const supabase = await createClient();
  const { gte, lt } = historyRange(history);
  // 조건은 서버에서 걸어 조건에 맞는 최신 100건을 읽는다
  let movementQuery = supabase
    .from("stock_movements")
    .select(
      "id, kind, item_id, location_id, to_location_id, qty, balance_after, total_after, note, created_at, actor:profiles(name, email)",
    )
    .eq("item_id", itemId);
  if (history.kind) movementQuery = movementQuery.eq("kind", history.kind);
  if (gte) movementQuery = movementQuery.gte("created_at", gte);
  if (lt) movementQuery = movementQuery.lt("created_at", lt);
  const [item, levels, movements] = await Promise.all([
    supabase.from("stock_items").select(ITEM_COLUMNS).eq("id", itemId).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("stock_levels").select("item_id, location_id, qty").eq("item_id", itemId),
    movementQuery
      .order("created_at", { ascending: false })
      .order("id")
      .limit(MOVEMENT_LIMIT),
  ]);
  const error = item.error ?? levels.error ?? movements.error;
  if (error) return fail("재고 품목 상세", error);
  if (!item.data) return null;
  return {
    item: toStockItem(item.data),
    levels: (levels.data ?? []).map(toStockLevel),
    movements: (movements.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind as StockMovementKind,
      itemId: m.item_id,
      locationId: m.location_id,
      toLocationId: m.to_location_id,
      qty: Number(m.qty),
      balanceAfter: Number(m.balance_after),
      totalAfter: Number(m.total_after),
      note: m.note,
      createdAt: m.created_at,
      actorName: m.actor ? m.actor.name || m.actor.email || NAMELESS_MEMBER_LABEL : null,
    })),
  };
}

export async function getStockCategories(workspaceId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("category")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .not("category", "is", null)
    .limit(ITEM_LIMIT);
  if (error) return fail("재고 카테고리", error);
  return [...new Set(data.map((r) => r.category as string))].sort((a, b) => a.localeCompare(b));
}
