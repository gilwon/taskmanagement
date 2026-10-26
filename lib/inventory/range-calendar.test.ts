// 기간 선택 달력 날짜 계산 테스트
import { describe, expect, it } from "vitest";
import { daysInclusive, keyToYmd, monthCells, shiftKey, ymdToKey } from "@/lib/inventory/range-calendar";

describe("range-calendar", () => {
  it("YYYY-MM-DD와 키를 오간다", () => {
    expect(keyToYmd(ymdToKey("2026-10-05")!)).toBe("2026-10-05");
    expect(ymdToKey("bad")).toBeNull();
  });
  it("달·해 경계를 넘어 날짜를 옮기고 일수를 센다", () => {
    expect(keyToYmd(shiftKey(ymdToKey("2026-12-31")!, 1))).toBe("2027-01-01");
    expect(daysInclusive(ymdToKey("2026-10-03")!, ymdToKey("2026-10-03")!)).toBe(1);
    expect(daysInclusive(ymdToKey("2026-02-27")!, ymdToKey("2026-03-02")!)).toBe(4);
  });
  it("2026년 10월은 목요일에 시작하는 31일이다", () => {
    const cells = monthCells(2026, 9);
    expect(cells.indexOf(1)).toBe(4);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});
