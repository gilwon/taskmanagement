// 재고 엑셀 업로드 시트 파싱 검증
import { describe, expect, it } from "vitest";
import { parseImportSheet } from "@/lib/inventory/import";

const KO = ["SKU", "품목명", "단위", "카테고리", "안전재고", "위치", "수량"];

describe("parseImportSheet", () => {
  it("한글 머리글 행을 정규화한다(공백 제거, 빈 셀은 null)", () => {
    const r = parseImportSheet([KO, [" PAPER ", " A4 ", "박스", "", 5, " 본사 ", "10"]]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { row: 2, sku: "PAPER", name: "A4", unit: "박스", category: null, safety: 5, location: "본사", qty: "10" },
    ]);
  });
  it("영문 머리글은 대소문자와 앞뒤 공백을 무시한다", () => {
    const r = parseImportSheet([[" SKU ", "Location", "QTY"], ["a", "창고", 3]]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ sku: "a", location: "창고", qty: "3", name: null, safety: null });
  });
  it("숫자 셀의 부동소수 잡음을 없앤다", () => {
    const r = parseImportSheet([KO, ["a", null, null, null, null, "창고", 0.1 + 0.2]]);
    expect(r.rows[0].qty).toBe("0.3");
  });
  it("SKU·위치·수량 머리글이 없으면 1행 오류만 돌려준다", () => {
    expect(parseImportSheet([["품목명"], ["x"]])).toEqual({
      rows: [],
      errors: [
        { row: 1, code: "missing_sku" },
        { row: 1, code: "missing_location" },
        { row: 1, code: "missing_qty" },
      ],
    });
  });
  it("빈 행은 건너뛰고 행 번호는 엑셀 위치를 유지한다", () => {
    const r = parseImportSheet([KO, [], ["a", null, null, null, null, "창고", 1], [null, " "], ["b", null, null, null, null, "창고", 2]]);
    expect(r.rows.map((x) => x.row)).toEqual([3, 5]);
  });
  it("데이터 행이 없거나 1000행을 넘으면 오류다", () => {
    expect(parseImportSheet([KO]).errors).toEqual([{ row: 1, code: "no_rows" }]);
    const many = Array.from({ length: 1001 }, (_, i) => [`s${i}`, null, null, null, null, "창고", 1]);
    expect(parseImportSheet([KO, ...many]).errors).toEqual([{ row: 1, code: "too_many_rows" }]);
  });
  it("행별로 필수값 누락을 알린다", () => {
    const r = parseImportSheet([KO, [null, null, null, null, null, null, "1"]]);
    expect(r.errors).toEqual([
      { row: 2, code: "sku_required" },
      { row: 2, code: "location_required" },
    ]);
    expect(r.rows).toEqual([]);
  });
  it("수량이 비었거나 숫자가 아니거나 음수·소수 4자리면 오류다", () => {
    const row = (q: unknown) => ["a", null, null, null, null, "창고", q];
    const r = parseImportSheet([KO, row(null), row("abc"), row(-1), row("1.2345"), row(0)]);
    expect(r.errors).toEqual([
      { row: 2, code: "qty_required" },
      { row: 3, code: "invalid_qty" },
      { row: 4, code: "invalid_qty" },
      { row: 5, code: "invalid_qty" },
    ]);
    expect(r.rows.map((x) => x.qty)).toEqual(["0"]);
  });
});
