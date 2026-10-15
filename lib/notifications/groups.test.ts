// 알림·활동 날짜 묶음 테스트
import { describe, expect, it } from "vitest";
import { dayGroup, groupInOrder, notificationGroup } from "./groups";

// 2026-10-15(목) 서울 오후 3시
const now = new Date("2026-10-15T06:00:00Z");

describe("notificationGroup", () => {
  it("오늘·어제·이번 주·이전으로 나눈다", () => {
    expect(notificationGroup("2026-10-15T00:30:00+09:00", now)).toBe("today");
    // UTC로는 14일이지만 서울로는 15일
    expect(notificationGroup("2026-10-14T16:00:00Z", now)).toBe("today");
    expect(notificationGroup("2026-10-14T12:00:00+09:00", now)).toBe("yesterday");
    expect(notificationGroup("2026-10-12T12:00:00+09:00", now)).toBe("week");
    expect(notificationGroup("2026-10-11T23:00:00+09:00", now)).toBe("earlier");
  });
  it("월요일에는 이번 주 묶음이 비고 그제부터 이전이다", () => {
    const monday = new Date("2026-10-12T03:00:00Z");
    expect(notificationGroup("2026-10-11T12:00:00+09:00", monday)).toBe("yesterday");
    expect(notificationGroup("2026-10-10T12:00:00+09:00", monday)).toBe("earlier");
  });
});

describe("dayGroup", () => {
  it("오늘·어제, 그 밖은 날짜와 요일", () => {
    expect(dayGroup("2026-10-15T01:00:00+09:00", now).label).toBe("오늘");
    expect(dayGroup("2026-10-14T01:00:00+09:00", now).label).toBe("어제");
    expect(dayGroup("2026-10-12T01:00:00+09:00", now).label).toBe("10월 12일 (월)");
    expect(dayGroup("2025-12-31T01:00:00+09:00", now).label).toBe("2025년 12월 31일 (수)");
  });
});

describe("groupInOrder", () => {
  it("이웃한 같은 키만 묶는다", () => {
    expect(groupInOrder([1, 1, 2, 1], (n) => n).map((g) => [g.key, g.items.length])).toEqual([
      [1, 2],
      [2, 1],
      [1, 1],
    ]);
  });
});
