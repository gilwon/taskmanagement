// 알림·활동 목록의 날짜 묶음 순수 함수. 서울 달력 날짜 기준이고 now를 인자로 받아 테스트할 수 있다
import { seoulDay } from "@/lib/format/date";
import type { Locale } from "@/lib/i18n/locales";

const DAY_MS = 86_400_000;

export type NotificationGroup = "today" | "yesterday" | "week" | "earlier";

// 알림 묶음. 오늘·어제·이번 주(일요일 시작, 오늘·어제 제외)·이전
export function notificationGroup(ts: string, now: Date): NotificationGroup {
  const day = seoulDay(ts);
  const today = seoulDay(now);
  const diff = Math.round((today - day) / DAY_MS);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  // UTC 자정 시각의 요일(일 0 ~ 토 6)이 곧 일요일부터 지난 일수다
  const sinceSunday = new Date(today).getUTCDay();
  return diff <= sinceSunday ? "week" : "earlier";
}

// 연도 유무에 따라 Intl의 요일 괄호 표기가 달라져 요일은 따로 붙인다. 로캘마다 한 번만 만든다
const formats = new Map<Locale, ReturnType<typeof makeFormats>>();
function makeFormats(locale: Locale) {
  return {
    day: new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", day: "numeric" }),
    yearDay: new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }),
    weekday: new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }),
    // 오늘·어제 낱말. ko "오늘"·"어제", en "today"·"yesterday"
    word: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  };
}
function formatsFor(locale: Locale) {
  let f = formats.get(locale);
  if (!f) formats.set(locale, (f = makeFormats(locale)));
  return f;
}

// 활동 날짜 묶음 이름과 키. 오늘·어제, 그 밖은 "10월 13일 (월)"(다른 해면 연도 포함)
export function dayGroup(ts: string, now: Date, locale: Locale = "ko"): { key: number; label: string } {
  const day = seoulDay(ts);
  const today = seoulDay(now);
  const diff = Math.round((today - day) / DAY_MS);
  const f = formatsFor(locale);
  if (diff <= 1) {
    const word = f.word.format(-Math.max(diff, 0), "day");
    return { key: day, label: word.charAt(0).toLocaleUpperCase(locale) + word.slice(1) };
  }
  const d = new Date(day);
  const fmt = d.getUTCFullYear() === new Date(today).getUTCFullYear() ? f.day : f.yearDay;
  return { key: day, label: `${fmt.format(d)} (${f.weekday.format(d)})` };
}

// 시간 내림차순 목록을 차례를 지키며 묶는다
export function groupInOrder<T, K>(items: T[], keyOf: (item: T) => K): { key: K; items: T[] }[] {
  const out: { key: K; items: T[] }[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(item);
    else out.push({ key, items: [item] });
  }
  return out;
}
