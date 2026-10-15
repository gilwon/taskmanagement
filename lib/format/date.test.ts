// 날짜 포맷터 경계 테스트. 서울 자정 전후, 연말, 7일 경계, DB date 해석
import { describe, expect, it } from "vitest";
import { formatDue, formatMonthTitle, formatRelative } from "./date";

// 2026-10-15(목) 12:00 KST
const NOON = new Date("2026-10-15T03:00:00Z");

describe("formatDue", () => {
  it("오늘·내일·어제", () => {
    expect(formatDue("2026-10-15", NOON)).toBe("오늘");
    expect(formatDue("2026-10-16", NOON)).toBe("내일");
    expect(formatDue("2026-10-14", NOON)).toBe("어제");
  });

  it("서울 자정 직전과 직후에 오늘이 바뀐다", () => {
    const beforeMidnight = new Date("2026-10-15T14:59:59Z"); // 10/15 23:59:59 KST
    const afterMidnight = new Date("2026-10-15T15:00:00Z"); // 10/16 00:00 KST
    expect(formatDue("2026-10-15", beforeMidnight)).toBe("오늘");
    expect(formatDue("2026-10-15", afterMidnight)).toBe("어제");
    expect(formatDue("2026-10-16", afterMidnight)).toBe("오늘");
  });

  it("DB date는 UTC 자정이 아니라 서울 날짜로 읽는다", () => {
    // UTC로 읽으면 KST 오전 8시(UTC 전날 23시)에 하루가 밀린다
    const earlyKst = new Date("2026-10-14T23:00:00Z"); // 10/15 08:00 KST
    expect(formatDue("2026-10-15", earlyKst)).toBe("오늘");
  });

  it("Date 인스턴스는 서울 날짜로 바꿔 비교한다", () => {
    expect(formatDue(new Date("2026-10-15T15:30:00Z"), NOON)).toBe("내일");
  });

  it("2~6일 차이는 요일, 7일부터는 날짜", () => {
    expect(formatDue("2026-10-17", NOON)).toBe("토");
    expect(formatDue("2026-10-21", NOON)).toBe("수");
    expect(formatDue("2026-10-22", NOON)).toBe("10월 22일");
    expect(formatDue("2026-10-09", NOON)).toBe("금");
    expect(formatDue("2026-10-08", NOON)).toBe("10월 8일");
  });

  it("연말과 다른 해", () => {
    const dec31 = new Date("2026-12-31T05:00:00Z");
    expect(formatDue("2027-01-01", dec31)).toBe("내일");
    expect(formatDue("2027-01-03", dec31)).toBe("일");
    expect(formatDue("2027-01-10", dec31)).toBe("2027년 1월 10일");
    expect(formatDue("2026-12-20", dec31)).toBe("12월 20일");
  });
});

describe("formatRelative", () => {
  it("분·시간·일 단위", () => {
    expect(formatRelative(new Date(NOON.getTime() - 30_000), NOON)).toBe("방금");
    expect(formatRelative(new Date(NOON.getTime() - 5 * 60_000), NOON)).toBe("5분 전");
    expect(formatRelative(new Date(NOON.getTime() - 2 * 3_600_000), NOON)).toBe("2시간 전");
    expect(formatRelative(new Date(NOON.getTime() - 3 * 86_400_000), NOON)).toBe("3일 전");
  });

  it("7일 이상은 날짜, 미래 시각은 방금", () => {
    expect(formatRelative("2026-10-05T03:00:00Z", NOON)).toBe("10월 5일");
    expect(formatRelative(new Date(NOON.getTime() + 60_000), NOON)).toBe("방금");
  });
});

describe("formatMonthTitle", () => {
  it("서울 기준 연월", () => {
    expect(formatMonthTitle(NOON)).toBe("2026년 10월");
    // 10/31 15:00 UTC는 서울 11/1
    expect(formatMonthTitle(new Date("2026-10-31T15:00:00Z"))).toBe("2026년 11월");
  });
});
