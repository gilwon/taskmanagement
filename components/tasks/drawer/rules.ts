// 드로어의 순수 규칙. 설명 링크 주소 검사, 기한 초과 일수, 이전·다음 작업
import { seoulDay } from "@/lib/format/date";
import type { TaskStatus } from "@/lib/tasks/types";

const HTTPS_RE = /^https:\/\/[^\s/]+\S*$/i;
const DAY_MS = 86_400_000;

// 링크 주소 검사. 통과하면 다듬은 주소, 아니면 null. 서버 정제기도 https만 남긴다
export function validLink(raw: string): string | null {
  const url = raw.trim();
  return HTTPS_RE.test(url) ? url : null;
}

// 기한이 지난 날 수(서울 달력 기준). 완료됐거나 기한이 없거나 지나지 않았으면 0
export function overdueDays(due: string | null, status: TaskStatus, now: Date) {
  if (!due || status === "done") return 0;
  return Math.max(0, Math.round((seoulDay(now) - seoulDay(due)) / DAY_MS));
}

// 보기 순서에서 앞뒤 작업 키. 목록에 없거나 처음·끝이면 그쪽은 null
export function neighbors(keys: readonly string[], key: string): { prev: string | null; next: string | null } {
  const i = keys.indexOf(key);
  if (i < 0) return { prev: null, next: null };
  return { prev: keys[i - 1] ?? null, next: keys[i + 1] ?? null };
}
