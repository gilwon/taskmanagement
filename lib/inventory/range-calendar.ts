// 기간 선택 달력의 날짜 계산. 날짜는 연*10000+월(0부터)*100+일 숫자 키로 다루고 주소 쿼리 값(YYYY-MM-DD)과 오간다

export const MIN_YEAR = 1900;
export const MAX_YEAR = 9999;

export const toKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
export const keyYear = (k: number) => Math.floor(k / 10000);
export const keyMonth = (k: number) => Math.floor(k / 100) % 100;
export const keyDay = (k: number) => k % 100;

// 키를 UTC 자정 시각(ms)으로 바꾼다. 표시 시간대와 무관하게 날이 밀리지 않는다
const utc = (k: number) => Date.UTC(keyYear(k), keyMonth(k), keyDay(k));

// 주소 쿼리 값 → 키. 형식이 다르면 null
export function ymdToKey(v: string | undefined | null): number | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? toKey(+m[1], +m[2] - 1, +m[3]) : null;
}

// 키 → YYYY-MM-DD
export function keyToYmd(k: number) {
  return `${String(keyYear(k)).padStart(4, "0")}-${String(keyMonth(k) + 1).padStart(2, "0")}-${String(keyDay(k)).padStart(2, "0")}`;
}

// 키에 일수를 더한 키
export function shiftKey(k: number, days: number) {
  const d = new Date(utc(k) + days * 86_400_000);
  return toKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// 시작·종료를 포함한 일수
export const daysInclusive = (a: number, b: number) => Math.round((utc(b) - utc(a)) / 86_400_000) + 1;

// 한 달을 6주(42칸)로 편 일자 배열. 일요일 시작이고 달 밖 칸은 null이다
export function monthCells(y: number, m: number): (number | null)[] {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, i) => {
    const d = i - first + 1;
    return d >= 1 && d <= n ? d : null;
  });
}
