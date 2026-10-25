// 재고 입력·판정 순수 규칙. 수량 파싱, 합계, 상태, 역할별 권한을 클라이언트와 Server Action이 함께 쓴다
import { isAdminRole, type Role } from "@/lib/org/rules";
import type { StockStatus } from "@/lib/inventory/types";

// 수량 상한(미만). DB numeric(14,3) 범위를 넘지 않게 막는다
const MAX_QTY = 1e11;

export type QtyResult = { ok: true; value: number } | { ok: false };

// 문자열은 앞뒤 공백을 지운 뒤 십진수 형식만 받는다(지수·16진수 표기 거부)
function parseNumber(input: string | number): number | null {
  let n: number;
  if (typeof input === "number") n = input;
  else {
    const s = input.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    n = Number(s);
  }
  if (!Number.isFinite(n) || n >= MAX_QTY) return null;
  // 소수 3자리까지만 허용한다. 부동소수 오차를 반올림으로 흡수한다
  if (Math.round(n * 1000) / 1000 !== n) return null;
  return n;
}

// 입고·출고·이동 수량. 0 초과만 허용한다
export function parseQty(input: string | number): QtyResult {
  const n = parseNumber(input);
  return n != null && n > 0 ? { ok: true, value: n } : { ok: false };
}

// 실사 목표 수량. 0을 허용한다
export function parseTarget(input: string | number): QtyResult {
  const n = parseNumber(input);
  return n != null && n >= 0 ? { ok: true, value: n } : { ok: false };
}

// 위치별 수량의 합. 소수 3자리로 반올림해 0.1 + 0.2 같은 오차를 없앤다
export function sumLevels(levels: { qty: number }[]): number {
  return Math.round(levels.reduce((sum, l) => sum + l.qty, 0) * 1000) / 1000;
}

// 합계가 0 이하면 out, 안전재고가 있고 합계가 그보다 작으면 low. 합계가 안전재고와 같으면 ok다
export function stockStatus(total: number, safety: number): StockStatus {
  if (total <= 0) return "out";
  return safety > 0 && total < safety ? "low" : "ok";
}

// 재고 화면 사용(보기·입출고·이동). 게스트와 소속 아님은 막는다
export function canUseStock(role: Role | null | undefined) {
  return isAdminRole(role) || role === "member";
}

// 품목·위치 관리
export function canManageStock(role: Role | null | undefined) {
  return isAdminRole(role);
}

export function canMoveStock(role: Role | null | undefined) {
  return canUseStock(role);
}

// 실사 조정
export function canAdjustStock(role: Role | null | undefined) {
  return isAdminRole(role);
}
