// 재고 RPC·DB 오류를 현재 로캘 문구로 바꾼다. 작업 오류 변환(taskErrorMessage)을 재고 문구로 덮어 확장한다.
// 문구는 사전(inventory.errors)에 있고, t를 넘기지 않으면 한국어로 돌려준다
import { taskErrorMessage } from "@/lib/tasks/errors";
import koInventory from "@/lib/i18n/messages/ko/inventory";
import type { MessageKey, Messages } from "@/lib/i18n/messages/types";
import { createT, type T } from "@/lib/i18n/t";

// 한국어 기본값. 클라이언트 번들에 사전 전체가 실리지 않게 inventory 영역만 담는다
const koT = createT({ inventory: koInventory } as unknown as Messages, "ko");

// 재고 RPC가 errcode P0001로 던지는 코드
const STOCK_RPC_MESSAGES = {
  insufficient_stock: "inventory.errors.insufficientStock",
  same_location: "inventory.errors.sameLocation",
  duplicate_sku: "inventory.errors.duplicateSku",
  duplicate_name: "inventory.errors.duplicateName",
  location_not_empty: "inventory.errors.locationNotEmpty",
  archived: "inventory.errors.archived",
  invalid_qty: "inventory.errors.invalidQty",
  note_required: "inventory.errors.noteRequired",
  not_found: "inventory.errors.notFound",
  forbidden: "inventory.errors.forbidden",
  invalid_import: "inventory.errors.invalidImport",
  import_invalid: "inventory.errors.importInvalid",
} as const satisfies Record<string, MessageKey>;

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// t가 없으면 재고 문구는 koT, 그 밖의 문구는 taskErrorMessage의 한국어 기본값을 쓴다
export function stockErrorMessage(error: DbError, t?: T): string {
  const say = t ?? koT;
  if (error?.code === "P0001" && error.message && Object.hasOwn(STOCK_RPC_MESSAGES, error.message)) {
    return say(STOCK_RPC_MESSAGES[error.message as keyof typeof STOCK_RPC_MESSAGES]);
  }
  if (error?.code === "PGRST116") return say(STOCK_RPC_MESSAGES.not_found);
  if (error?.code === "42501") return say(STOCK_RPC_MESSAGES.forbidden);
  return taskErrorMessage(error, t);
}

// 엑셀 업로드 행 오류 코드(앱 검사와 RPC 공통)별 사유 문구 키. 모르는 코드는 일반 문구로 보인다
const IMPORT_REASONS = {
  missing_sku: "inventory.import.reason.missingSku",
  missing_location: "inventory.import.reason.missingLocation",
  missing_qty: "inventory.import.reason.missingQty",
  no_rows: "inventory.import.reason.noRows",
  too_many_rows: "inventory.import.reason.tooManyRows",
  sku_required: "inventory.import.reason.skuRequired",
  location_required: "inventory.import.reason.locationRequired",
  qty_required: "inventory.import.reason.qtyRequired",
  invalid_safety: "inventory.import.reason.invalidSafety",
  location_not_found: "inventory.import.reason.locationNotFound",
  duplicate_row: "inventory.import.reason.duplicateRow",
  name_required: "inventory.import.reason.nameRequired",
  unit_required: "inventory.import.reason.unitRequired",
  truncated: "inventory.import.reason.truncated",
  invalid_qty: "inventory.errors.invalidQty",
  archived: "inventory.errors.archived",
  duplicate_sku: "inventory.errors.duplicateSku",
  note_required: "inventory.errors.noteRequired",
} as const satisfies Record<string, MessageKey>;

export function importReason(code: string, t: T): string {
  return t(Object.hasOwn(IMPORT_REASONS, code) ? IMPORT_REASONS[code as keyof typeof IMPORT_REASONS] : "inventory.import.reason.unknown");
}
