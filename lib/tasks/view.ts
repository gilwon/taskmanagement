// 작업 목록에 뷰 상태(필터·검색·정렬·그룹)를 적용하는 순수 함수와 뷰 상태 기본값·파서
import { seoulDay } from "@/lib/format/date";
import {
  DUE_BUCKET_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
} from "@/lib/i18n/labels";
import {
  COLUMN_KEYS,
  DATE_RANGES,
  DUE_BUCKETS,
  FILTER_FIELDS,
  GROUP_FIELDS,
  SORT_FIELDS,
  type ColumnKey,
  type DateRange,
  type DueBucket,
  type Filter,
  type FilterField,
  type TaskGroup,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type ViewState,
} from "@/lib/tasks/types";

const DAY_MS = 86_400_000;

// META §3 뷰 상태 기본값. 공유 객체이므로 고치지 말고 복사해서 쓴다
export const DEFAULT_VIEW_STATE: Readonly<ViewState> = Object.freeze<ViewState>({
  filters: [],
  sort: { f: "manual", dir: 1 },
  group: "status",
  q: "",
  hidden: ["start", "created", "deps"],
  colW: {},
  showDone: true,
});

export const STATUS_ORDER: readonly TaskStatus[] = ["backlog", "todo", "progress", "review", "done"];
export const PRIORITY_ORDER: readonly TaskPriority[] = ["urgent", "high", "medium", "low", "none"];
const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

const RANGE_MS: Record<DateRange, number> = { "24h": DAY_MS, "7d": 7 * DAY_MS, "30d": 30 * DAY_MS };

// 열 폭 하한은 META §3의 64px. 상한은 손상된 값 방어용
const COL_MIN = 64;
const COL_MAX = 1200;

// DB check 제약(user_view_states.view_key)과 같은 형식
const VIEW_KEY_RE =
  /^(tasks|mytasks|cal|tl|(p|sv):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function isViewKey(value: string) {
  return VIEW_KEY_RE.test(value);
}

// 기한 구간. 서울 달력 날짜 차이로 나눈다. 상태와 무관하게 날짜만 본다
export function dueBucket(due: string | null, now: Date): DueBucket {
  if (!due) return "none";
  const diff = Math.round((seoulDay(due) - seoulDay(now)) / DAY_MS);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "next7";
  return "later";
}

// 필터가 비교할 작업의 값 목록
function fieldValues(item: TaskItem, f: FilterField, now: Date): string[] {
  switch (f) {
    case "status":
      return [item.status];
    case "assignee":
      return [item.assignee_id ?? "none"];
    case "priority":
      return [item.priority];
    case "due":
      return [dueBucket(item.due_date, now)];
    case "project":
      return [item.project_id];
    case "labels":
      return item.labels;
    case "created":
    case "updated": {
      const elapsed = now.getTime() - new Date(f === "created" ? item.created_at : item.updated_at).getTime();
      return DATE_RANGES.filter((r) => elapsed <= RANGE_MS[r]);
    }
  }
}

// 값이 빈 필터는 조건이 없는 것으로 본다
function matches(item: TaskItem, filter: Filter, now: Date) {
  if (filter.v.length === 0) return true;
  const hit = fieldValues(item, filter.f, now).some((x) => filter.v.includes(x));
  return filter.op === "is" ? hit : !hit;
}

function matchesQuery(item: TaskItem, q: string) {
  if (!q) return true;
  return item.title.toLowerCase().includes(q) || item.key.toLowerCase().includes(q);
}

// 정렬 키. null은 방향과 무관하게 맨 뒤로 보낸다. 우선순위는 긴급이 먼저 오도록 가중치를 뒤집는다
function sortKey(item: TaskItem, f: ViewState["sort"]["f"]): number | string | null {
  switch (f) {
    case "manual":
      return Number(item.sort_order);
    case "priority":
      return -PRIORITY_WEIGHT[item.priority];
    case "due":
      return item.due_date;
    case "start":
      return item.start_date;
    case "title":
      return item.title;
    case "status":
      return STATUS_ORDER.indexOf(item.status);
    case "assignee":
      return item.assignee?.name ?? null;
    case "created":
      return item.created_at;
    case "updated":
      return item.updated_at;
  }
}

function compareKeys(a: number | string, b: number | string) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ko");
}

export function sortItems(items: readonly TaskItem[], sort: ViewState["sort"]): TaskItem[] {
  return [...items].sort((x, y) => {
    const a = sortKey(x, sort.f);
    const b = sortKey(y, sort.f);
    if (a === null || b === null) {
      if (a !== b) return a === null ? 1 : -1;
    } else {
      const c = compareKeys(a, b) * sort.dir;
      if (c !== 0) return c;
    }
    // 같은 값이면 수동 순서, 그다음 생성 순서로 고정한다
    return Number(x.sort_order) - Number(y.sort_order) || x.created_at.localeCompare(y.created_at);
  });
}

function groupOf(item: TaskItem, group: ViewState["group"], now: Date): { key: string; label: string } {
  switch (group) {
    case "status":
      return { key: item.status, label: TASK_STATUS_LABELS[item.status] };
    case "priority":
      return { key: item.priority, label: TASK_PRIORITY_LABELS[item.priority] };
    case "assignee":
      return item.assignee
        ? { key: item.assignee.id, label: item.assignee.name }
        : { key: "none", label: UNASSIGNED_LABEL };
    case "project":
      return { key: item.project_id, label: item.project.name };
    case "due": {
      const bucket = dueBucket(item.due_date, now);
      return { key: bucket, label: DUE_BUCKET_LABELS[bucket] };
    }
    case "none":
      return { key: "all", label: "모든 작업" };
  }
}

// 필터 → 완료 숨김 → 검색 → 정렬 → 그룹 순서로 적용한다.
// 상태·우선순위 그룹은 빈 묶음도 고정 순서로 모두 돌려준다(보드 열). 완료 숨김이면 done 묶음은 뺀다.
// 그 밖의 그룹은 작업이 있는 묶음만, 기한은 구간 순서, 담당자·프로젝트는 이름순(담당자 없음은 맨 뒤)이다
export function applyView(items: readonly TaskItem[], state: ViewState, ctx: { now: Date }): TaskGroup[] {
  const q = state.q.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (state.showDone || item.status !== "done") &&
      state.filters.every((f) => matches(item, f, ctx.now)) &&
      matchesQuery(item, q),
  );
  const sorted = sortItems(visible, state.sort);

  const groups = new Map<string, TaskGroup>();
  const seed = (key: string, label: string) => groups.set(key, { key, label, items: [] });
  if (state.group === "status") {
    for (const s of STATUS_ORDER) if (state.showDone || s !== "done") seed(s, TASK_STATUS_LABELS[s]);
  } else if (state.group === "priority") {
    for (const p of PRIORITY_ORDER) seed(p, TASK_PRIORITY_LABELS[p]);
  } else if (state.group === "due") {
    for (const b of DUE_BUCKETS) seed(b, DUE_BUCKET_LABELS[b]);
  }
  for (const item of sorted) {
    const { key, label } = groupOf(item, state.group, ctx.now);
    if (!groups.has(key)) seed(key, label);
    groups.get(key)!.items.push(item);
  }

  const result = [...groups.values()];
  if (state.group === "due") return result.filter((g) => g.items.length > 0);
  if (state.group === "assignee" || state.group === "project") {
    return result.sort((a, b) => {
      if (a.key === "none" || b.key === "none") return a.key === "none" ? 1 : -1;
      return a.label.localeCompare(b.label, "ko");
    });
  }
  if (state.group === "none" && result.length === 0) return [{ key: "all", label: "모든 작업", items: [] }];
  return result;
}

// ─────────────────────────────────────────────
// 뷰 상태 파서. DB의 state jsonb는 사용자가 쓴 값이라 손상됐을 수 있다. 칸마다 검증하고 틀리면 기본값
// ─────────────────────────────────────────────

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function parseFilter(raw: unknown): Filter[] {
  if (!isObject(raw) || !includes(FILTER_FIELDS, raw.f)) return [];
  const op = raw.op === "not" ? "not" : "is";
  const v = Array.isArray(raw.v) ? [...new Set(raw.v.filter((x): x is string => typeof x === "string"))] : [];
  return [{ f: raw.f, op, v: v.slice(0, 100) }];
}

export function parseViewState(json: unknown): ViewState {
  const o = isObject(json) ? json : {};
  const sort = isObject(o.sort) && includes(SORT_FIELDS, o.sort.f)
    ? { f: o.sort.f, dir: o.sort.dir === -1 ? (-1 as const) : (1 as const) }
    : { ...DEFAULT_VIEW_STATE.sort };
  const hidden = Array.isArray(o.hidden)
    ? [...new Set(o.hidden.filter((c): c is ColumnKey => includes(COLUMN_KEYS, c) && c !== "task"))]
    : [...DEFAULT_VIEW_STATE.hidden];
  const colW: ViewState["colW"] = {};
  if (isObject(o.colW)) {
    for (const [k, w] of Object.entries(o.colW)) {
      if (includes(COLUMN_KEYS, k) && typeof w === "number" && Number.isFinite(w)) {
        colW[k] = Math.min(COL_MAX, Math.max(COL_MIN, Math.round(w)));
      }
    }
  }
  return {
    filters: Array.isArray(o.filters) ? o.filters.slice(0, 50).flatMap(parseFilter) : [],
    sort,
    group: includes(GROUP_FIELDS, o.group) ? o.group : DEFAULT_VIEW_STATE.group,
    q: typeof o.q === "string" ? o.q.slice(0, 200) : "",
    hidden,
    colW,
    showDone: typeof o.showDone === "boolean" ? o.showDone : true,
  };
}
