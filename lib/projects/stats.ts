// 프로젝트 화면 순수 함수. 작업 집계·진행률, 목록 필터·정렬, 담당자별 부하, 새 프로젝트 키 미리보기
import { todayIso } from "@/lib/schedule/dates";
import type { TaskStatus } from "@/lib/tasks/types";
import type { ProjectFilter, ProjectSort, ProjectSummary, TaskLite, TaskStats } from "@/lib/projects/types";

export const TASK_STATUSES: readonly TaskStatus[] = ["backlog", "todo", "progress", "review", "done"];

// 작업 집계. 기한 지남은 서울 날짜 기준 오늘보다 기한이 앞선 열린 작업이다.
// "YYYY-MM-DD"라 문자열 비교가 날짜 비교다
export function taskStats(tasks: readonly Pick<TaskLite, "status" | "due_date">[], now: Date): TaskStats {
  const today = todayIso(now);
  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  let overdue = 0;
  for (const t of tasks) {
    byStatus[t.status] += 1;
    if (t.status !== "done" && t.due_date !== null && t.due_date < today) overdue += 1;
  }
  const total = tasks.length;
  const done = byStatus.done;
  return { total, done, open: total - done, overdue, pct: total > 0 ? Math.round((done / total) * 100) : 0, byStatus };
}

// 프로젝트 행이나 그 작업 중 가장 늦게 바뀐 시각(ISO 문자열 비교)
export function lastActive(projectUpdatedAt: string, tasks: readonly Pick<TaskLite, "updated_at">[]) {
  let latest = projectUpdatedAt;
  for (const t of tasks) if (t.updated_at > latest) latest = t.updated_at;
  return latest;
}

// 내 프로젝트는 프로젝트 구성원(project_members)이거나 리드인 프로젝트다.
// 공개 프로젝트의 암묵적 편집 권한만 있는 경우는 넣지 않는다(모든 공개 프로젝트가 걸려 필터 의미가 없어진다)
export function filterProjects(list: readonly ProjectSummary[], f: ProjectFilter, meId: string) {
  const q = f.q.trim().toLowerCase();
  return list.filter(
    (p) =>
      (f.archived || p.archivedAt === null) &&
      (f.status === "all" || p.status === f.status) &&
      (!f.mine || p.leadId === meId || p.memberIds.includes(meId)) &&
      (!q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)),
  );
}

const byName = (a: ProjectSummary, b: ProjectSummary) => a.name.localeCompare(b.name, "ko");

// 최근 활동은 늦은 순, 기한은 이른 순(없음은 뒤), 진행률은 높은 순. 같으면 이름순
export function sortProjects(list: readonly ProjectSummary[], sort: ProjectSort) {
  const cmp: Record<ProjectSort, (a: ProjectSummary, b: ProjectSummary) => number> = {
    recent: (a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt),
    name: () => 0,
    due: (a, b) => {
      if (a.dueDate === b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    },
    progress: (a, b) => b.stats.pct - a.stats.pct,
  };
  return [...list].sort((a, b) => cmp[sort](a, b) || byName(a, b));
}

// 담당자별 열린 작업 수. 많은 순, 담당자 없음은 뺀다
export function workload(tasks: readonly Pick<TaskLite, "status" | "assignee_id">[]) {
  const map = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done" || !t.assignee_id) continue;
    map.set(t.assignee_id, (map.get(t.assignee_id) ?? 0) + 1);
  }
  return [...map].map(([userId, open]) => ({ userId, open })).sort((a, b) => b.open - a.open);
}

// create_project의 키 규칙을 그대로 따른 미리보기. 공백으로 나눈 단어 중 영문자로 시작하는 단어의
// 첫 글자를 대문자로 최대 3자 잇고, 없으면 "P". 이미 있는 키면 DB가 뒤에 X를 붙인다
export function projectKeyPreview(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return letters || "P";
}
