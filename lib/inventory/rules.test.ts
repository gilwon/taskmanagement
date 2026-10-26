// 재고 수량 파싱·합계·상태·역할 판정 검증
import { describe, expect, it } from "vitest";
import {
  canAdjustStock,
  canManageStock,
  canMoveStock,
  canUseStock,
  historyRange,
  parseHistoryFilter,
  parseQty,
  parseTarget,
  stockStatus,
  sumLevels,
} from "@/lib/inventory/rules";

describe("parseQty", () => {
  it("공백을 지우고 소수 3자리까지 받는다", () => {
    expect(parseQty(" 1.250 ")).toEqual({ ok: true, value: 1.25 });
    expect(parseQty(3)).toEqual({ ok: true, value: 3 });
  });
  it("0·음수·소수 4자리·숫자 아님·상한 이상은 실패한다", () => {
    for (const bad of ["0", "-1", "1.2345", "abc", "", "  ", "1e3", 1e11, Number.NaN]) {
      expect(parseQty(bad)).toEqual({ ok: false });
    }
  });
});

describe("parseTarget", () => {
  it("0을 허용하고 음수는 거부한다", () => {
    expect(parseTarget("0")).toEqual({ ok: true, value: 0 });
    expect(parseTarget("-0.001")).toEqual({ ok: false });
  });
});

describe("sumLevels", () => {
  it("부동소수 오차를 없앤다", () => {
    expect(sumLevels([{ qty: 0.1 }, { qty: 0.2 }])).toBe(0.3);
    expect(sumLevels([])).toBe(0);
  });
});

describe("stockStatus", () => {
  it("합계가 0 이하면 out이다", () => {
    expect(stockStatus(0, 5)).toBe("out");
  });
  it("안전재고보다 작을 때만 low이고 같으면 ok다", () => {
    expect(stockStatus(4.999, 5)).toBe("low");
    expect(stockStatus(5, 5)).toBe("ok");
  });
  it("안전재고가 0이면 재고가 있는 한 ok다", () => {
    expect(stockStatus(0.001, 0)).toBe("ok");
  });
});

describe("역할 판정", () => {
  const cases = [
    ["owner", true, true, true, true],
    ["admin", true, true, true, true],
    ["member", true, false, true, false],
    ["guest", false, false, false, false],
    [null, false, false, false, false],
    [undefined, false, false, false, false],
  ] as const;
  it.each(cases)("%s", (role, use, manage, move, adjust) => {
    expect([canUseStock(role), canManageStock(role), canMoveStock(role), canAdjustStock(role)]).toEqual([
      use,
      manage,
      move,
      adjust,
    ]);
  });
});

describe("parseHistoryFilter", () => {
  it("올바른 값은 통과하고 잘못된 값은 무시한다", () => {
    expect(parseHistoryFilter({ hk: "out", hf: "2026-10-01", ht: "2026-10-26" })).toEqual({
      kind: "out",
      from: "2026-10-01",
      to: "2026-10-26",
    });
    expect(parseHistoryFilter({ hk: "bogus", hf: "2026-13-01", ht: "abc" })).toEqual({
      kind: undefined,
      from: undefined,
      to: undefined,
    });
    expect(parseHistoryFilter({ hk: ["in"], hf: ["2026-10-01"] })).toEqual({ kind: undefined, from: undefined, to: undefined });
  });
  it("실존하지 않는 날짜는 거른다(2월 29일은 윤년만)", () => {
    expect(parseHistoryFilter({ hf: "2028-02-29" }).from).toBe("2028-02-29");
    expect(parseHistoryFilter({ hf: "2026-02-29" }).from).toBeUndefined();
    expect(parseHistoryFilter({ hf: "2026-04-31" }).from).toBeUndefined();
    expect(parseHistoryFilter({ hf: "2026-1-1" }).from).toBeUndefined();
  });
});

describe("historyRange", () => {
  it("시작은 from 00:00, 종료는 to 다음 날 00:00 미만(서울)이다", () => {
    expect(historyRange({ from: "2026-10-01", to: "2026-10-26" })).toEqual({
      gte: "2026-10-01T00:00:00+09:00",
      lt: "2026-10-27T00:00:00+09:00",
    });
  });
  it("하나만 있으면 그쪽 경계만 만든다", () => {
    expect(historyRange({ from: "2026-10-01" })).toEqual({ gte: "2026-10-01T00:00:00+09:00", lt: undefined });
    expect(historyRange({ to: "2026-10-26" }).gte).toBeUndefined();
  });
  it("월말·연말·윤년 2월 말 다음 날을 넘긴다", () => {
    expect(historyRange({ to: "2026-12-31" }).lt).toBe("2027-01-01T00:00:00+09:00");
    expect(historyRange({ to: "2028-02-28" }).lt).toBe("2028-02-29T00:00:00+09:00");
    expect(historyRange({ to: "2028-02-29" }).lt).toBe("2028-03-01T00:00:00+09:00");
  });
  it("시작일이 종료일보다 늦으면 gte가 lt 이상이라 빈 구간이 된다", () => {
    const r = historyRange({ from: "2026-10-26", to: "2026-10-01" });
    expect(new Date(r.gte!).getTime()).toBeGreaterThanOrEqual(new Date(r.lt!).getTime());
  });
});
