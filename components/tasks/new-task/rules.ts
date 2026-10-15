// 새 작업 모달의 순수 규칙. 입력 필드 형태, 하위 작업 여러 줄 해석, 편집 모드 변경분 계산
import type { RepeatKind, TaskItem, TaskPatch, TaskPriority, TaskStatus } from "@/lib/tasks/types";

export type Fields = {
  title: string;
  description: string | null;
  projectId: string;
  status: TaskStatus;
  assigneeId: string | null;
  priority: TaskPriority;
  due: string | null;
  start: string | null;
  labels: string[];
  recur: RepeatKind;
  subtasks: string;
};

// 여러 줄 입력을 하위 작업 제목 목록으로 바꾼다. 빈 줄은 버리고 500자로 자른다
export function parseSubtaskLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim().slice(0, 500))
    .filter(Boolean);
}

// 편집 모드에서 바뀐 값만 모은다. 상태는 이동 RPC로 바꾸므로 따로 돌려준다
export function diffPatch(t: TaskItem, f: Fields): { patch: TaskPatch; status: TaskStatus | null } {
  const patch: TaskPatch = {};
  if (f.title.trim() !== t.title) patch.title = f.title.trim();
  if (f.description !== t.description_html) patch.descriptionHtml = f.description;
  if (f.assigneeId !== t.assignee_id) patch.assigneeId = f.assigneeId;
  if (f.priority !== t.priority) patch.priority = f.priority;
  if (f.due !== t.due_date) patch.due = f.due;
  if (f.start !== t.start_date) patch.start = f.start;
  if (f.labels.join() !== t.labels.join()) patch.labels = f.labels;
  if (f.recur !== t.recur) patch.recur = f.recur;
  return { patch, status: f.status !== t.status ? f.status : null };
}
