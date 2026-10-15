// 작업 화면 공용 타입. 화면용 작업(TaskItem), 뷰 상태(ViewState), 서버 액션 결과 형태를 정의한다
import type { Enums, Tables } from "@/lib/database.types";

export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;
export type RepeatKind = Enums<"repeat_kind">;
export type TaskRow = Tables<"tasks">;

// 화면에 그리는 작업 한 건. tasks 행에 표시용 요약을 붙인다.
// description_html은 서버가 읽을 때 정제한 값이다
export type TaskItem = TaskRow & {
  assignee: { id: string; name: string; color: string } | null;
  project: { id: string; key: string; name: string; color: string; icon: string };
  subtaskDone: number;
  subtaskTotal: number;
  commentCount: number;
  attachmentCount: number;
  // 이 작업을 막고 있는 작업 id 목록(task_deps.blocked_by_id)
  blockedBy: string[];
};

// 담당자 선택·아바타용 구성원. color는 workspace_members.color(없으면 profiles.color)
export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: Enums<"ws_role">;
  status: Enums<"member_status">;
  title: string | null;
};

export type Subtask = Tables<"subtasks">;

// 드로어가 쓰는 작업 상세. 막는 작업은 키·제목·상태까지 보인다
export type TaskDetail = {
  subtasks: Subtask[];
  blockedBy: { id: string; key: string; title: string; status: TaskStatus }[];
};

// ─────────────────────────────────────────────
// 뷰 상태(user_view_states.state)
// ─────────────────────────────────────────────

export const FILTER_FIELDS = ["status", "assignee", "priority", "due", "project", "labels", "created", "updated"] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

// 기한 구간. Asia/Seoul 달력 날짜 기준
export const DUE_BUCKETS = ["overdue", "today", "next7", "later", "none"] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

// 생성·수정 시각 구간
export const DATE_RANGES = ["24h", "7d", "30d"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

// 값 어휘. status·priority는 enum 값, assignee는 사용자 id 또는 "none"(미지정),
// project는 프로젝트 id, labels는 라벨 id, due는 DueBucket, created·updated는 DateRange
export type Filter = { f: FilterField; op: "is" | "not"; v: string[] };

export const SORT_FIELDS = [
  "manual",
  "priority",
  "due",
  "start",
  "title",
  "status",
  "assignee",
  "created",
  "updated",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const GROUP_FIELDS = ["status", "priority", "assignee", "project", "due", "none"] as const;
export type GroupField = (typeof GROUP_FIELDS)[number];

// 표 열. task는 항상 보이므로 숨김 대상이 아니다
export const COLUMN_KEYS = [
  "task",
  "status",
  "priority",
  "assignee",
  "due",
  "start",
  "labels",
  "deps",
  "estimate",
  "created",
  "project",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type ViewState = {
  filters: Filter[];
  // dir 1 오름차순, -1 내림차순
  sort: { f: SortField; dir: 1 | -1 };
  group: GroupField;
  q: string;
  hidden: ColumnKey[];
  // 열 폭(px). 키는 ColumnKey
  colW: Partial<Record<ColumnKey, number>>;
  showDone: boolean;
};

// 뷰 키(spec R15). p:·sv: 뒤는 프로젝트·저장 뷰 uuid
export type ViewKey = "tasks" | "mytasks" | "cal" | "tl" | `p:${string}` | `sv:${string}`;

// applyView 결과 한 묶음. 그룹 없음이면 key "all" 하나
export type TaskGroup = { key: string; label: string; items: TaskItem[] };

// ─────────────────────────────────────────────
// 서버 액션 입력·결과
// ─────────────────────────────────────────────

// 실패를 빈 성공으로 숨기지 않는다(spec R22). error는 화면에 그대로 보일 한국어 문구
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CreateTaskInput = {
  projectId: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  start?: string | null;
  due?: string | null;
  labels?: string[];
  descriptionHtml?: string | null;
  estimate?: string | null;
  recur?: RepeatKind;
  sortOrder?: number | null;
};

// 직접 수정 가능한 필드. 상태는 moveTask·completeTask·reopenTask로 바꾼다.
// 프로젝트 이동은 DB가 막는다(guard_task_update: 키가 프로젝트에 묶여 있다)
export type TaskPatch = Partial<{
  title: string;
  priority: TaskPriority;
  assigneeId: string | null;
  start: string | null;
  due: string | null;
  labels: string[];
  estimate: string | null;
  recur: RepeatKind;
  descriptionHtml: string | null;
  sortOrder: number;
  archived: boolean;
}>;

// 완료·이동 결과. 반복 작업이 done이 되면 next에 다음 회차가 온다
export type CompleteResult = { item: TaskItem; next: TaskItem | null };

export type BulkPatch = Partial<{ status: TaskStatus; assigneeId: string | null; priority: TaskPriority }>;

// 권한 없는 행은 RLS가 조용히 건너뛰므로 failedIds로 알린다. created는 bulk 완료로 생긴 반복 회차
export type BulkResult = { updated: TaskItem[]; created: TaskItem[]; failedIds: string[] };

// 복원 토큰은 RPC가 준 updated_at 문자열 그대로다(마이크로초). Date로 바꾸지 않는다
export type DeleteResult = { token: string };
export type BulkDeleteResult = { tokens: Record<string, string>; failedIds: string[] };

// 일괄 복원 결과. failedIds는 실패 전부, conflictIds는 그중 삭제 뒤 바뀌어 토큰이 맞지 않은 작업이다.
// error는 conflict가 아닌 실패(권한·네트워크 등)의 대표 문구이고 그런 실패가 없으면 null이다
export type BulkRestoreResult = {
  restored: TaskItem[];
  failedIds: string[];
  conflictIds: string[];
  error: string | null;
};

export type SubtaskPatch = Partial<{
  title: string;
  done: boolean;
  assigneeId: string | null;
  due: string | null;
  note: string | null;
  sortOrder: number;
}>;
