// 날짜·상대 시간 표시 포맷터. ko-KR, Asia/Seoul 기준이고 now를 인자로 받아 테스트할 수 있다
const TZ = "Asia/Seoul";
const DAY_MS = 86_400_000;

const seoulParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
// 아래 셋은 Date.UTC로 만든 "달력 날짜"를 받으므로 UTC로 읽어야 날이 밀리지 않는다
const weekdayFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });
const fullDateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const monthTitleFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, year: "numeric", month: "long" });

type DateInput = Date | string | number;

// 서울 기준 달력 날짜를 UTC 자정 시각(ms)으로 돌려준다.
// DB date("YYYY-MM-DD")는 이미 서울 날짜이므로 시간대 변환 없이 그대로 쓴다
function seoulDay(input: DateInput) {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  const parts = seoulParts.formatToParts(new Date(input));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

// 기한 표시. 오늘·내일·어제, 2~6일 차이는 요일, 7일 이상은 "10월 26일"(다른 해면 연도 포함).
// 7일 차이는 오늘과 요일이 같아 헷갈리므로 요일 대신 날짜로 보인다
export function formatDue(date: DateInput, now: Date) {
  const day = seoulDay(date);
  const today = seoulDay(now);
  const diff = Math.round((day - today) / DAY_MS);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  const d = new Date(day);
  if (Math.abs(diff) < 7) return weekdayFmt.format(d);
  if (d.getUTCFullYear() !== new Date(today).getUTCFullYear()) return fullDateFmt.format(d);
  return monthDayFmt.format(d);
}

// 상대 시간 표시. 방금 → N분 전 → N시간 전 → N일 전(7일 미만), 그 이후는 formatDue 형식
export function formatRelative(ts: DateInput, now: Date) {
  const elapsed = now.getTime() - new Date(ts).getTime();
  // 시계 차이로 미래 시각이 오면 방금으로 본다
  if (elapsed < 60_000) return "방금";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatDue(ts, now);
}

// 월 탐색 제목. "2026년 10월"
export function formatMonthTitle(date: DateInput) {
  return monthTitleFmt.format(new Date(date));
}
