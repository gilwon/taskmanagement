"use server";
// 재고 Server Action. 품목·위치 관리와 입고·출고·이동·조정을 RPC로 호출한다. 권한·재고 규칙의 최종 판정은 RPC가 한다.
// 수량은 서버에서 다시 파싱한다. 화면 갱신은 클라이언트가 router.refresh로 한다
import { stockErrorMessage } from "@/lib/inventory/errors";
import { parseQty, parseTarget } from "@/lib/inventory/rules";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/tasks/types";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };
type ItemInput = { name: string; sku: string; unit: string; category: string | null; safetyStock: number | string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class InputError extends Error {}
// 수량 검증 실패. 일반 입력 오류와 문구가 달라 따로 둔다
class QtyError extends Error {}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function err<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function dbErr<R>(what: string, error: DbError, t: T): ActionResult<R> {
  console.error(`[${what}]`, error.code, error.message);
  return err(stockErrorMessage(error, t));
}

// Server Action은 직접 POST로도 불릴 수 있다. 매번 검증된 클레임으로 사용자를 확인한다
async function session(): Promise<{ supabase: Client; uid: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  return uid ? { supabase, uid } : null;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new InputError();
  return value;
}

function str(value: unknown): string {
  if (typeof value !== "string") throw new InputError();
  return value;
}

function optStr(value: unknown): string | undefined {
  return value == null ? undefined : str(value);
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new InputError();
  return value;
}

function qty(value: unknown, parse: typeof parseQty): number {
  if (typeof value !== "string" && typeof value !== "number") throw new QtyError();
  const r = parse(value);
  if (!r.ok) throw new QtyError();
  return r.value;
}

// 품목 입력. 문자열 길이·중복은 RPC가 판정한다. 안전재고는 0 이상 수량 형식만 받는다
function itemArgs(input: ItemInput) {
  if (typeof input !== "object" || input === null) throw new InputError();
  return {
    p_name: str(input.name),
    p_sku: str(input.sku),
    p_unit: str(input.unit),
    p_category: optStr(input.category) ?? "",
    p_safety: qty(input.safetyStock, parseTarget),
  };
}

// 검증 실패와 예상하지 못한 예외를 결과로 바꾼다. 실패를 빈 성공으로 숨기지 않는다
async function run<R>(
  what: string,
  body: (s: { supabase: Client; uid: string; t: T }) => Promise<ActionResult<R>>,
) {
  const t = await getT();
  try {
    const s = await session();
    if (!s) return err<R>(t("errors.msg.sessionExpired"));
    return await body({ ...s, t });
  } catch (e) {
    if (e instanceof QtyError) return err<R>(t("inventory.errors.invalidQty"));
    if (e instanceof InputError) return err<R>(t("errors.rpc.invalidInput"));
    console.error(`[${what}]`, e);
    return err<R>(stockErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t));
  }
}

export async function createStockItem(workspaceId: string, input: ItemInput): Promise<ActionResult<{ id: string }>> {
  return run("재고 품목 생성", async ({ supabase, t }) => {
    const { data, error } = await supabase.rpc("stock_create_item", { p_ws: uuid(workspaceId), ...itemArgs(input) });
    if (error) return dbErr("재고 품목 생성", error, t);
    return ok({ id: data.id });
  });
}

export async function updateStockItem(itemId: string, input: ItemInput): Promise<ActionResult<null>> {
  return run("재고 품목 수정", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_update_item", { p_item: uuid(itemId), ...itemArgs(input) });
    if (error) return dbErr("재고 품목 수정", error, t);
    return ok(null);
  });
}

export async function setStockItemArchived(itemId: string, archived: boolean): Promise<ActionResult<null>> {
  return run("재고 품목 보관", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_set_item_archived", { p_item: uuid(itemId), p_archived: bool(archived) });
    if (error) return dbErr("재고 품목 보관", error, t);
    return ok(null);
  });
}

export async function createStockLocation(workspaceId: string, name: string): Promise<ActionResult<{ id: string }>> {
  return run("재고 위치 생성", async ({ supabase, t }) => {
    const { data, error } = await supabase.rpc("stock_create_location", { p_ws: uuid(workspaceId), p_name: str(name) });
    if (error) return dbErr("재고 위치 생성", error, t);
    return ok({ id: data.id });
  });
}

export async function renameStockLocation(locationId: string, name: string): Promise<ActionResult<null>> {
  return run("재고 위치 이름 변경", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_rename_location", { p_location: uuid(locationId), p_name: str(name) });
    if (error) return dbErr("재고 위치 이름 변경", error, t);
    return ok(null);
  });
}

export async function setStockLocationArchived(locationId: string, archived: boolean): Promise<ActionResult<null>> {
  return run("재고 위치 보관", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_set_location_archived", {
      p_location: uuid(locationId),
      p_archived: bool(archived),
    });
    if (error) return dbErr("재고 위치 보관", error, t);
    return ok(null);
  });
}

export async function receiveStock(
  itemId: string,
  locationId: string,
  quantity: string | number,
  note?: string | null,
): Promise<ActionResult<null>> {
  return run("재고 입고", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_receive", {
      p_item: uuid(itemId),
      p_location: uuid(locationId),
      p_qty: qty(quantity, parseQty),
      p_note: optStr(note),
    });
    if (error) return dbErr("재고 입고", error, t);
    return ok(null);
  });
}

export async function issueStock(
  itemId: string,
  locationId: string,
  quantity: string | number,
  note?: string | null,
): Promise<ActionResult<null>> {
  return run("재고 출고", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_issue", {
      p_item: uuid(itemId),
      p_location: uuid(locationId),
      p_qty: qty(quantity, parseQty),
      p_note: optStr(note),
    });
    if (error) return dbErr("재고 출고", error, t);
    return ok(null);
  });
}

export async function transferStock(
  itemId: string,
  fromLocationId: string,
  toLocationId: string,
  quantity: string | number,
  note?: string | null,
): Promise<ActionResult<null>> {
  return run("재고 이동", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_transfer", {
      p_item: uuid(itemId),
      p_from: uuid(fromLocationId),
      p_to: uuid(toLocationId),
      p_qty: qty(quantity, parseQty),
      p_note: optStr(note),
    });
    if (error) return dbErr("재고 이동", error, t);
    return ok(null);
  });
}

export async function adjustStock(
  itemId: string,
  locationId: string,
  target: string | number,
  note?: string | null,
): Promise<ActionResult<null>> {
  return run("재고 조정", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("stock_adjust", {
      p_item: uuid(itemId),
      p_location: uuid(locationId),
      p_target: qty(target, parseTarget),
      p_note: optStr(note),
    });
    if (error) return dbErr("재고 조정", error, t);
    return ok(null);
  });
}
