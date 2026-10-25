// 재고 수량 파싱·합계·상태·역할 판정 검증
import { describe, expect, it } from "vitest";
import {
  canAdjustStock,
  canManageStock,
  canMoveStock,
  canUseStock,
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
