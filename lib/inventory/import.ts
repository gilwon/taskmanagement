// 재고 엑셀 업로드 순수 규칙. 시트 값을 머리글 별칭으로 매핑해 행으로 정규화하고 형식 오류를 모은다. 클라이언트와 Server Action이 함께 쓴다
import { parseTarget } from "@/lib/inventory/rules";

export const MAX_IMPORT_ROWS = 1000;

// RPC stock_import에 보내는 행. row는 엑셀 행 번호(머리글이 1행)이고 qty는 10진 문자열이다
export type ImportRow = {
  row: number;
  sku: string;
  name: string | null;
  unit: string | null;
  category: string | null;
  safety: number | null;
  location: string;
  qty: string;
};

export type ImportRowError = { row: number; code: string };

export type ImportSummary = { created: number; adjusted: number; skipped: number };

// 행 오류 목록은 실패 결과에만 붙는다. 일반 ActionResult와 호환되는 확장형이다
export type ImportResult =
  | { ok: true; data: ImportSummary }
  | { ok: false; error: string; rowErrors?: ImportRowError[] };

type Key = "sku" | "name" | "unit" | "category" | "safety" | "location" | "qty";

// 머리글 별칭. 비교 전에 앞뒤 공백을 지우고 소문자로 바꾼다
const ALIASES: Record<string, Key> = {
  sku: "sku",
  품목명: "name",
  name: "name",
  단위: "unit",
  unit: "unit",
  카테고리: "category",
  category: "category",
  안전재고: "safety",
  safety: "safety",
  위치: "location",
  location: "location",
  수량: "qty",
  qty: "qty",
};

// 부동소수 잡음(0.30000000000000004)을 15자리 유효숫자로 정리한다. 지수 표기는 그대로 둬서 이후 수량 검증이 거부한다
function cleanNumber(n: number): string {
  return String(Number(n.toPrecision(15)));
}

// 셀 값을 앞뒤 공백 없는 문자열로 바꾼다. 빈 셀은 null이다
function text(v: unknown): string | null {
  if (v == null) return null;
  const s = (typeof v === "number" ? cleanNumber(v) : String(v)).trim();
  return s === "" ? null : s;
}

export function parseImportSheet(data: unknown[][]): { rows: ImportRow[]; errors: ImportRowError[] } {
  const header = data[0] ?? [];
  const col: Partial<Record<Key, number>> = {};
  header.forEach((h, i) => {
    const key = ALIASES[String(h ?? "").trim().toLowerCase()];
    if (key && col[key] === undefined) col[key] = i;
  });

  const errors: ImportRowError[] = [];
  if (col.sku === undefined) errors.push({ row: 1, code: "missing_sku" });
  if (col.location === undefined) errors.push({ row: 1, code: "missing_location" });
  if (col.qty === undefined) errors.push({ row: 1, code: "missing_qty" });
  if (errors.length > 0) return { rows: [], errors };

  const cell = (r: unknown[], key: Key) => (col[key] === undefined ? null : r[col[key]]);
  const body = data.slice(1).map((r, i) => ({ r, row: i + 2 }));
  // 완전히 빈 행은 건너뛴다. 행 번호는 건너뛰기 전 위치로 유지한다
  const filled = body.filter(({ r }) => r.some((v) => text(v) !== null));
  if (filled.length === 0) return { rows: [], errors: [{ row: 1, code: "no_rows" }] };
  if (filled.length > MAX_IMPORT_ROWS) return { rows: [], errors: [{ row: 1, code: "too_many_rows" }] };

  const rows: ImportRow[] = [];
  for (const { r, row } of filled) {
    const before = errors.length;
    const sku = text(cell(r, "sku"));
    const location = text(cell(r, "location"));
    const qty = text(cell(r, "qty"));
    const safetyText = text(cell(r, "safety"));
    if (!sku) errors.push({ row, code: "sku_required" });
    if (!location) errors.push({ row, code: "location_required" });
    if (!qty) errors.push({ row, code: "qty_required" });
    else if (!parseTarget(qty).ok) errors.push({ row, code: "invalid_qty" });
    const safety = safetyText === null ? null : parseTarget(safetyText);
    if (safety && !safety.ok) errors.push({ row, code: "invalid_safety" });
    if (sku && location && qty && errors.length === before) {
      rows.push({
        row,
        sku,
        name: text(cell(r, "name")),
        unit: text(cell(r, "unit")),
        category: text(cell(r, "category")),
        safety: safety?.ok ? safety.value : null,
        location,
        qty,
      });
    }
  }
  return { rows, errors };
}
