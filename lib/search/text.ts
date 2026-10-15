// 검색어 정리·LIKE 패턴·일치 구간 나누기·발췌. 클라이언트와 서버가 함께 쓰는 순수 함수
export const SEARCH_MAX_LEN = 100;

// 문자열이 아니면 빈 값. 앞뒤 공백을 지우고 연속 공백을 하나로 줄인 뒤 길이 상한으로 자른다
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_LEN).trim();
}

// LIKE 메타문자를 문자 그대로 찾도록 이스케이프한다. 역슬래시를 먼저 바꿔야 뒤에 붙인 역슬래시가 다시 바뀌지 않는다
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// 이스케이프 뒤에 *를 바꿔야 바꾼 _가 다시 이스케이프되지 않는다.
// shortcut: PostgREST가 ilike 값의 *를 %로 바꿔서 *는 한 글자 와일드카드(_)로 보내고 containsQuery로 다시 거른다. 그래서 *가 든 검색은 limit보다 적게 나올 수 있다. 정확한 개수가 필요해지면 검색 RPC(position() 비교)로 바꾼다
export function likePattern(q: string): string {
  return `%${escapeLike(q).replace(/\*/g, "_")}%`;
}

// 대소문자 무시 위치 찾기. 소문자로 바꿀 때 길이가 달라지는 문자(예 İ)가 있으면 위치가 어긋나므로 원문 그대로 찾는다
function lowerIndexOf(text: string, q: string, from = 0): number {
  const lt = text.toLowerCase();
  const lq = q.toLowerCase();
  if (lt.length !== text.length || lq.length !== q.length) return text.indexOf(q, from);
  return lt.indexOf(lq, from);
}

// 서버 조회 결과를 문자 그대로 일치하는 것만 남길 때 쓴다
export function containsQuery(text: string | null | undefined, q: string): boolean {
  if (!text || !q) return false;
  return lowerIndexOf(text, q) !== -1;
}

// q가 나오는 구간을 hit로 나눈다. 정규식을 쓰지 않아 특수문자도 그대로 찾는다
export function splitHighlight(text: string, q: string): { text: string; hit: boolean }[] {
  if (!q) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (let i = lowerIndexOf(text, q); i !== -1; i = lowerIndexOf(text, q, pos)) {
    if (i > pos) parts.push({ text: text.slice(pos, i), hit: false });
    parts.push({ text: text.slice(i, i + q.length), hit: true });
    pos = i + q.length;
  }
  if (pos < text.length || parts.length === 0) parts.push({ text: text.slice(pos), hit: false });
  return parts;
}

// q 주변 width자 발췌. 공백을 하나로 줄이고, 잘린 쪽에 말줄임표를 붙인다. q가 없으면 앞부분
export function excerpt(text: string, q: string, width = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const hit = q ? lowerIndexOf(flat, q) : -1;
  let start = hit === -1 ? 0 : Math.max(0, hit - Math.floor((width - q.length) / 2));
  const end = Math.min(flat.length, start + width);
  start = Math.max(0, end - width);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}
