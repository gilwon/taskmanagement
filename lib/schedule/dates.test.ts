// 일정 날짜 계산 테스트. 월 그리드, 기간 유지 이동, 바 편집, 주말 판정, 월·연 경계, 주소 값 해석
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  diffDays,
  editBar,
  isIsoDate,
  isWeekend,
  monthGrid,
  moveKeepingSpan,
  parseCalendarParams,
  startOfWeek,
  timelineRange,
  todayIso,
  weekOf,
  weekTitle,
} from "./dates";

describe("monthGrid", () => {
  it("2026년 10월은 1일이 목요일이라 9월 27일 일요일부터 시작한다", () => {
    const grid = monthGrid("2026-10-15");
    expect(grid).toHaveLength(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0]).toBe("2026-09-27");
    expect(grid[0][4]).toBe("2026-10-01");
    expect(grid[5][6]).toBe("2026-11-07");
  });

  it("1일이 일요일이면 그날부터 시작한다", () => {
    expect(monthGrid("2026-11-10")[0][0]).toBe("2026-11-01");
  });

  it("윤년 2월 29일이 들어간다", () => {
    const days = monthGrid("2028-02-01").flat();
    expect(days).toContain("2028-02-29");
    expect(days).toContain("2028-03-01");
  });
});

describe("날짜 산술", () => {
  it("월·연 경계를 넘는다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(diffDays("2026-12-30", "2027-01-02")).toBe(3);
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("주는 일요일에 시작하고 토·일이 주말이다", () => {
    // 일요일 당일은 그날이 주 시작, 토요일 당일은 그 주의 마지막 날
    expect(startOfWeek("2026-10-11")).toBe("2026-10-11");
    expect(startOfWeek("2026-10-17")).toBe("2026-10-11");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-18");
    expect(weekOf("2026-10-15")).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
    expect(isWeekend("2026-10-17")).toBe(true);
    expect(isWeekend("2026-10-18")).toBe(true);
    expect(isWeekend("2026-10-16")).toBe(false);
    expect(isWeekend("2026-10-19")).toBe(false);
  });

  it("오늘은 서울 기준이다", () => {
    expect(todayIso(new Date("2026-10-15T14:59:59Z"))).toBe("2026-10-15");
    expect(todayIso(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-16");
  });

  it("없는 날짜는 거부한다", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-15")).toBe(true);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });
});

describe("moveKeepingSpan", () => {
  it("시작일도 같은 일수만큼 옮겨 기간을 유지한다", () => {
    expect(moveKeepingSpan({ start: "2026-10-10", due: "2026-10-14" }, "2026-10-20")).toEqual({
      start: "2026-10-16",
      due: "2026-10-20",
    });
  });

  it("월 경계를 넘어 앞으로 옮긴다", () => {
    expect(moveKeepingSpan({ start: "2026-11-02", due: "2026-11-03" }, "2026-10-30")).toEqual({
      start: "2026-10-29",
      due: "2026-10-30",
    });
  });

  it("시작일이 없으면 기한만 옮긴다", () => {
    expect(moveKeepingSpan({ start: null, due: "2026-10-14" }, "2026-10-15")).toEqual({
      start: null,
      due: "2026-10-15",
    });
  });
});

describe("editBar", () => {
  it("전체 이동은 있는 날짜만 옮긴다", () => {
    expect(editBar("2026-10-10", "2026-10-12", "move", 3)).toEqual({ start: "2026-10-13", due: "2026-10-15" });
    expect(editBar(null, "2026-10-12", "move", -2)).toEqual({ start: null, due: "2026-10-10" });
  });

  it("끝 조절은 반대쪽 끝을 넘지 않는다", () => {
    expect(editBar("2026-10-10", "2026-10-12", "start", 5)).toEqual({ start: "2026-10-12", due: "2026-10-12" });
    expect(editBar("2026-10-10", "2026-10-12", "due", -5)).toEqual({ start: "2026-10-10", due: "2026-10-10" });
    expect(editBar("2026-10-10", "2026-10-12", "due", 2)).toEqual({ start: "2026-10-10", due: "2026-10-14" });
  });

  it("한쪽 날짜만 있으면 끝 조절이 비어 있던 쪽을 채운다", () => {
    expect(editBar(null, "2026-10-12", "start", -3)).toEqual({ start: "2026-10-09", due: "2026-10-12" });
    expect(editBar("2026-10-12", null, "due", 1)).toEqual({ start: "2026-10-12", due: "2026-10-13" });
  });
});

describe("parseCalendarParams", () => {
  const today = "2026-10-15";
  it("주·월·기본값", () => {
    expect(parseCalendarParams({ w: "2026-10-15" }, today)).toEqual({ anchor: "2026-10-11", mode: "week" });
    expect(parseCalendarParams({ m: "2026-11" }, today)).toEqual({ anchor: "2026-11-01", mode: "month" });
    expect(parseCalendarParams({}, today)).toEqual({ anchor: today, mode: "month" });
  });

  it("틀린 값은 이번 달로 돌아간다", () => {
    expect(parseCalendarParams({ m: "2026-13" }, today)).toEqual({ anchor: today, mode: "month" });
    expect(parseCalendarParams({ w: "2026-02-30" }, today)).toEqual({ anchor: today, mode: "month" });
    expect(parseCalendarParams({ m: ["2026-11"] }, today)).toEqual({ anchor: today, mode: "month" });
  });
});

describe("timelineRange", () => {
  it("오늘과 모든 날짜를 담고 일요일에 시작한다", () => {
    const r = timelineRange(["2026-10-20", "2026-11-30"], "2026-10-15");
    expect(r.start).toBe("2026-10-04");
    expect(addDays(r.start, r.days - 1)).toBe("2026-12-21");
  });

  it("날짜가 없으면 오늘 주변만", () => {
    const r = timelineRange([], "2026-10-15");
    expect(r.start).toBe("2026-10-04");
    expect(r.days).toBe(diffDays("2026-10-04", "2026-11-05") + 1);
  });
});

describe("weekTitle", () => {
  it("한 달 안, 두 달에 걸침, 해가 바뀜", () => {
    expect(weekTitle("2026-10-11")).toBe("2026년 10월");
    expect(weekTitle("2026-09-27")).toBe("2026년 9월 – 10월");
    expect(weekTitle("2026-12-27")).toBe("2026년 12월 – 2027년 1월");
  });
});
