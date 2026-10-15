// 캘린더·타임라인 순수 날짜 계산. 날짜는 "YYYY-MM-DD" 문자열과 Date.UTC 자정 ms로만 다룬다(서울 달력 날짜, 로컬 시간대 메서드 금지)
import { seoulDay } from "@/lib/format/date";

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function toIso(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

// 실제로 있는 날짜인지(2월 30일 같은 값은 거부)
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  return !!m && toIso(Date.UTC(+m[1], +m[2] - 1, +m[3])) === value;
}

// 서울 기준 오늘
export function todayIso(now: Date) {
  return toIso(seoulDay(now));
}

export function addDays(iso: string, n: number) {
  return toIso(seoulDay(iso) + n * DAY_MS);
}

// b - a 일수
export function diffDays(a: string, b: string) {
  return Math.round((seoulDay(b) - seoulDay(a)) / DAY_MS);
}

// 월요일 0 … 일요일 6
export function weekdayIndex(iso: string) {
  return (new Date(seoulDay(iso)).getUTCDay() + 6) % 7;
}

export function isWeekend(iso: string) {
  return weekdayIndex(iso) >= 5;
}

export function startOfWeek(iso: string) {
  return addDays(iso, -weekdayIndex(iso));
}

export function weekOf(anchor: string) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// "YYYY-MM"
export function monthOf(iso: string) {
  return iso.slice(0, 7);
}

export function firstOfMonth(iso: string) {
  return `${monthOf(iso)}-01`;
}

export function addMonths(iso: string, n: number) {
  const d = new Date(seoulDay(firstOfMonth(iso)));
  return toIso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

// 월 그리드. 월요일 시작, 칸 수가 바뀌면 화면이 들썩이므로 항상 6주 42칸이다
export function monthGrid(anchor: string): string[][] {
  const start = startOfWeek(firstOfMonth(anchor));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

// 기간 유지 이동. 기한을 newDue로 옮기고 시작일이 있으면 같은 일수만큼 옮긴다(start <= due 제약이 그대로 지켜진다)
export function moveKeepingSpan(task: { start: string | null; due: string }, newDue: string) {
  const delta = diffDays(task.due, newDue);
  return { due: newDue, start: task.start ? addDays(task.start, delta) : null };
}

// 시작·기한 중 있는 것만 delta일 옮긴다
export function shiftRange(start: string | null, due: string | null, delta: number) {
  return { start: start && addDays(start, delta), due: due && addDays(due, delta) };
}

export type BarEdit = "move" | "start" | "due";

// 타임라인 바 편집 결과. 한쪽 날짜만 있으면 1일 바로 보고, 끝 조절은 비어 있던 쪽도 채운다.
// 끝 조절은 반대쪽 끝을 넘지 못한다(DB check start_date <= due_date)
export function editBar(start: string | null, due: string | null, edit: BarEdit, delta: number) {
  if (edit === "move") return shiftRange(start, due, delta);
  const s = (start ?? due)!;
  const e = (due ?? start)!;
  if (edit === "start") {
    const next = addDays(s, delta);
    return { start: diffDays(next, e) < 0 ? e : next, due: e };
  }
  const next = addDays(e, delta);
  return { start: s, due: diffDays(s, next) < 0 ? s : next };
}

// 주 보기 제목. 한 달 안이면 "2026년 10월", 두 달에 걸치면 "2026년 9월 – 10월", 해가 바뀌면 "2026년 12월 – 2027년 1월"
export function weekTitle(weekStart: string) {
  const end = addDays(weekStart, 6);
  const [y1, m1] = [Number(weekStart.slice(0, 4)), Number(weekStart.slice(5, 7))];
  const [y2, m2] = [Number(end.slice(0, 4)), Number(end.slice(5, 7))];
  if (y1 !== y2) return `${y1}년 ${m1}월 – ${y2}년 ${m2}월`;
  if (m1 !== m2) return `${y1}년 ${m1}월 – ${m2}월`;
  return `${y1}년 ${m1}월`;
}

// 캘린더 주소 값. ?w=YYYY-MM-DD면 그 주, ?m=YYYY-MM이면 그 달, 틀리거나 없으면 이번 달
export function parseCalendarParams(
  params: { m?: string | string[]; w?: string | string[] },
  today: string,
): { anchor: string; mode: "month" | "week" } {
  const w = typeof params.w === "string" ? params.w : undefined;
  if (isIsoDate(w)) return { anchor: startOfWeek(w), mode: "week" };
  const m = typeof params.m === "string" ? params.m : undefined;
  if (m && MONTH_RE.test(m)) return { anchor: `${m}-01`, mode: "month" };
  return { anchor: today, mode: "month" };
}

// 캘린더 화면이 보여 주는 첫날과 마지막 날(일정 조회 범위)
export function calendarRange(anchor: string, mode: "month" | "week") {
  if (mode === "week") {
    const days = weekOf(anchor);
    return { from: days[0], to: days[6] };
  }
  const grid = monthGrid(anchor);
  return { from: grid[0][0], to: grid[5][6] };
}

// 타임라인 날짜 범위. 날짜들과 오늘을 모두 담고 앞 1주·뒤 3주 여유를 둔 월요일 시작 범위
export function timelineRange(dates: string[], today: string) {
  let min = today;
  let max = today;
  for (const d of dates) {
    if (diffDays(d, min) > 0) min = d;
    if (diffDays(max, d) > 0) max = d;
  }
  const start = startOfWeek(addDays(min, -7));
  return { start, days: diffDays(start, addDays(max, 21)) + 1 };
}
