// sort_order 계산 경계 테스트. 빈 목록, 맨 앞·맨 뒤, 중간, 범위 밖 index
import { describe, expect, it } from "vitest";
import { orderAt, orderBetween } from "./order";

describe("orderBetween", () => {
  it("앞뒤가 없으면 1", () => expect(orderBetween(null, null)).toBe(1));
  it("맨 앞은 다음 값 - 1", () => expect(orderBetween(null, 3)).toBe(2));
  it("맨 뒤는 앞 값 + 1", () => expect(orderBetween(3, null)).toBe(4));
  it("사이는 중간값", () => expect(orderBetween(1, 2)).toBe(1.5));
});

describe("orderAt", () => {
  const orders = [1, 2, 4];
  it("index 0은 맨 앞", () => expect(orderAt(orders, 0)).toBe(0));
  it("중간 자리", () => expect(orderAt(orders, 2)).toBe(3));
  it("목록 길이 이상은 맨 뒤", () => {
    expect(orderAt(orders, 3)).toBe(5);
    expect(orderAt(orders, 99)).toBe(5);
  });
  it("빈 목록", () => expect(orderAt([], 0)).toBe(1));
});
