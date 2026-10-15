// 로캘별 날짜·시간·상대 시간·숫자 포매터. Asia/Seoul 기준이고 now를 인자로 받아 테스트할 수 있다. 서버·클라이언트가 함께 쓴다
import type { Locale } from "@/lib/i18n/locales";

const TZ = "Asia/Seoul";
const DAY_MS = 86_400_000;

const seoulParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

type DateInput = Date | string | number;

// 서울 기준 달력 날짜를 UTC 자정 시각(ms)으로 돌려준다.
// DB date("YYYY-MM-DD")는 이미 서울 날짜이므로 시간대 변환 없이 그대로 쓴다
export function seoulDay(input: DateInput) {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  const parts = seoulParts.formatToParts(new Date(input));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

// Intl의 "지금(now)"보다 자연스러운 1분 미만 표시. 없는 로캘은 Intl 값을 쓴다
const JUST_NOW: Partial<Record<Locale, string>> = { ko: "방금", en: "Just now" };

export type Formatter = ReturnType<typeof createFormatter>;

export function createFormatter(locale: Locale) {
  // 아래 셋은 Date.UTC로 만든 "달력 날짜"를 받으므로 UTC로 읽어야 날이 밀리지 않는다
  const weekdayFmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" });
  const monthDayFmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric" });
  const fullDateFmt = new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
  const monthTitleFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, year: "numeric", month: "long" });
  // 화면 설정의 시간 형식(24시간제)을 따른다
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  // 오늘·내일·어제만 낱말로 쓴다. "그저께"처럼 ±2일 낱말이 나오지 않게 N 단위는 numeric always다
  const dayWordFmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const agoFmt = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" });
  const numberFmt = new Intl.NumberFormat(locale);
  const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

  // 기한 표시. 오늘·내일·어제, 2~6일 차이는 요일, 7일 이상은 날짜(다른 해면 연도 포함).
  // 7일 차이는 오늘과 요일이 같아 헷갈리므로 요일 대신 날짜로 보인다
  function due(date: DateInput, now: Date) {
    const day = seoulDay(date);
    const today = seoulDay(now);
    const diff = Math.round((day - today) / DAY_MS);
    if (Math.abs(diff) <= 1) return upperFirst(dayWordFmt.format(diff, "day"));
    const d = new Date(day);
    if (Math.abs(diff) < 7) return weekdayFmt.format(d);
    if (d.getUTCFullYear() !== new Date(today).getUTCFullYear()) return fullDateFmt.format(d);
    return monthDayFmt.format(d);
  }

  // 상대 시간 표시. 방금 → N분 전 → N시간 전 → N일 전(7일 미만), 그 이후는 due 형식
  function relative(ts: DateInput, now: Date) {
    const elapsed = now.getTime() - new Date(ts).getTime();
    // 시계 차이로 미래 시각이 오면 방금으로 본다
    if (elapsed < 60_000) return JUST_NOW[locale] ?? upperFirst(dayWordFmt.format(0, "second"));
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 60) return agoFmt.format(-minutes, "minute");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return agoFmt.format(-hours, "hour");
    const days = Math.floor(hours / 24);
    if (days < 7) return agoFmt.format(-days, "day");
    return due(ts, now);
  }

  return {
    locale,
    due,
    relative,
    // 월 탐색 제목. ko "2026년 10월", en "October 2026"
    monthTitle: (date: DateInput) => monthTitleFmt.format(new Date(date)),
    // 서울 달력 날짜. ko "10월 26일", en "Oct 26"
    date: (date: DateInput) => monthDayFmt.format(new Date(seoulDay(date))),
    time: (ts: DateInput) => timeFmt.format(new Date(ts)),
    dateTime: (ts: DateInput) => dateTimeFmt.format(new Date(ts)),
    number: (n: number) => numberFmt.format(n),
  };
}
