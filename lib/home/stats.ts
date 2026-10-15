// 홈·내 작업 화면의 집계 순수 함수. store의 작업 배열에서 stat·탭·마감 묶음·진행률을 만들어 완료 토글이 바로 반영된다
import type { Enums } from "@/lib/database.types";
import { addDays, diffDays, startOfWeek, todayIso } from "@/lib/schedule/dates";
import type { TaskItem } from "@/lib/tasks/types";

// 서울 날짜 기준 오늘과의 일 차이. 기한이 없으면 null
function dayDiff(due: string | null, now: Date) {
  return due ? diffDays(todayIso(now), due) : null;
}

const isOpen = (t: TaskItem) => t.status !== "done";
const isOverdue = (t: TaskItem, now: Date) => isOpen(t) && (dayDiff(t.due_date, now) ?? 0) < 0;

// 기한 오름차순(없음은 뒤), 같으면 수동 순서
export function byDue(a: TaskItem, b: TaskItem) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return Number(a.sort_order) - Number(b.sort_order);
}

// 완료 시각 내림차순
function byCompleted(a: TaskItem, b: TaskItem) {
  return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
}

export type HomeStats = {
  activeProjects: number;
  riskProjects: number;
  openTasks: number;
  myOpenTasks: number;
  doneThisWeek: number;
  overdue: number;
};

// 진행 중 프로젝트는 상태 active·risk(위험도 진행 중인 프로젝트로 센다)
export function homeStats(
  items: readonly TaskItem[],
  projects: readonly { status: Enums<"project_status"> }[],
  meId: string,
  now: Date,
): HomeStats {
  // 주는 월요일 시작(prefs weekStart 1). "YYYY-MM-DD"라 문자열 비교가 날짜 비교다
  const monday = startOfWeek(todayIso(now));
  const open = items.filter(isOpen);
  return {
    activeProjects: projects.filter((p) => p.status === "active" || p.status === "risk").length,
    riskProjects: projects.filter((p) => p.status === "risk").length,
    openTasks: open.length,
    myOpenTasks: open.filter((t) => t.assignee_id === meId).length,
    doneThisWeek: items.filter(
      (t) => t.status === "done" && t.completed_at && todayIso(new Date(t.completed_at)) >= monday,
    ).length,
    overdue: items.filter((t) => isOverdue(t, now)).length,
  };
}

// 홈 "내 작업" 탭. 예정은 완료도 기한 지남도 아닌 작업(오늘·기한 없음 포함)
export function myTaskTabs(items: readonly TaskItem[], meId: string, now: Date) {
  const mine = items.filter((t) => t.assignee_id === meId);
  return {
    upcoming: mine.filter((t) => isOpen(t) && !isOverdue(t, now)).sort(byDue),
    overdue: mine.filter((t) => isOverdue(t, now)).sort(byDue),
    done: mine.filter((t) => !isOpen(t)).sort(byCompleted),
  };
}

// 내 작업 화면 묶음. 입력 순서(뷰 정렬)를 묶음 안에서 그대로 지킨다
export type MyTaskBucket = "overdue" | "today" | "upcoming" | "done";
export function myTaskBucket(t: TaskItem, now: Date): MyTaskBucket {
  if (!isOpen(t)) return "done";
  const diff = dayDiff(t.due_date, now);
  if (diff === null || diff > 0) return "upcoming";
  return diff === 0 ? "today" : "overdue";
}

// 다가오는 마감. 워크스페이스 전체의 열린 작업 중 오늘·내일·이번 주(모레부터 이번 주 일요일까지, 월요일 시작).
// 토요일이면 이번 주 묶음은 비고, 일요일이면 내일이 다음 주 월요일이라 이번 주 묶음은 비어 있다
export function deadlineGroups(items: readonly TaskItem[], now: Date) {
  const today = todayIso(now);
  const sunday = addDays(startOfWeek(today), 6);
  const open = items.filter(isOpen).sort(byDue);
  const within = (lo: string, hi: string) => open.filter((t) => t.due_date !== null && t.due_date >= lo && t.due_date <= hi);
  return {
    today: within(today, today),
    tomorrow: within(addDays(today, 1), addDays(today, 1)),
    week: within(addDays(today, 2), sunday),
  };
}

// 프로젝트별 완료/전체. store 작업은 이미 삭제·보관을 뺀 목록이다
export function projectProgress(items: readonly TaskItem[]) {
  const map = new Map<string, { done: number; total: number; assignees: Set<string> }>();
  for (const t of items) {
    const p = map.get(t.project_id) ?? { done: 0, total: 0, assignees: new Set<string>() };
    p.total += 1;
    if (t.status === "done") p.done += 1;
    if (t.assignee_id) p.assignees.add(t.assignee_id);
    map.set(t.project_id, p);
  }
  return map;
}
