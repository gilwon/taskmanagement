"use server";
// 작업 쓰기 Server Action. 세션 클레임을 확인하고 입력을 검증한 뒤 RLS가 걸린 서버 클라이언트로 쓰고, 결과를 한국어 오류와 함께 돌려준다
import { MSG } from "@/lib/auth/errors";
import type { TablesUpdate } from "@/lib/database.types";
import { sanitizeTaskHtml } from "@/lib/html/sanitize";
import { ESTIMATE_LABELS, TASK_LABEL_LABELS } from "@/lib/i18n/labels";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { selectTaskDetail, selectTaskItems } from "@/lib/tasks/queries";
import type {
  ActionResult,
  BulkDeleteResult,
  BulkPatch,
  BulkRestoreResult,
  BulkResult,
  CompleteResult,
  CreateTaskInput,
  DeleteResult,
  RepeatKind,
  Subtask,
  SubtaskPatch,
  TaskDetail,
  TaskItem,
  TaskPatch,
  TaskStatus,
  ViewKey,
} from "@/lib/tasks/types";
import { isViewKey, parseViewState, PRIORITY_ORDER, STATUS_ORDER } from "@/lib/tasks/view";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPEATS: readonly RepeatKind[] = ["none", "daily", "weekly", "biweekly", "monthly"];
const LABELS = Object.keys(TASK_LABEL_LABELS);
const ESTIMATES = Object.keys(ESTIMATE_LABELS).filter((e) => e !== "clear");
const MAX_BULK = 500;
const INVALID = "입력값을 다시 확인해 주세요.";

class InputError extends Error {}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function err<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function dbErr<T>(what: string, error: DbError): ActionResult<T> {
  console.error(`[${what}]`, error.code, error.message);
  return err(taskErrorMessage(error));
}

// Server Action은 직접 POST로도 불릴 수 있다. 매번 검증된 클레임으로 사용자를 확인한다
async function session(): Promise<{ supabase: Client; uid: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  return uid ? { supabase, uid } : null;
}

// ─────────────────────────────────────────────
// 입력 검증(신뢰 경계). 틀리면 InputError
// ─────────────────────────────────────────────

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new InputError();
  return value;
}

function uuids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BULK) throw new InputError();
  return [...new Set(value.map(uuid))];
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T {
  if (typeof value !== "string" || !(list as readonly string[]).includes(value)) throw new InputError();
  return value as T;
}

function title(value: unknown): string {
  const t = typeof value === "string" ? value.trim() : "";
  if (t.length < 1 || t.length > 500) throw new InputError();
  return t;
}

function optDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) throw new InputError();
  return value;
}

function optUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) throw new InputError();
  return [...new Set(value.map((l) => oneOf(LABELS, l)))];
}

function optEstimate(value: unknown): string | null {
  return value === null ? null : oneOf(ESTIMATES, value);
}

function sortOrder(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new InputError();
  return value;
}

// 저장 시 정제(spec R13). 정제 후 비면 null
function description(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 100_000) throw new InputError();
  const clean = sanitizeTaskHtml(value).trim();
  return clean === "" ? null : clean;
}

// 검증 실패와 예상하지 못한 예외를 결과로 바꾼다. 실패를 빈 성공으로 숨기지 않는다
async function run<T>(what: string, body: (s: { supabase: Client; uid: string }) => Promise<ActionResult<T>>) {
  try {
    const s = await session();
    if (!s) return err<T>(MSG.sessionExpired);
    return await body(s);
  } catch (e) {
    if (e instanceof InputError) return err<T>(INVALID);
    console.error(`[${what}]`, e);
    return err<T>(taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }));
  }
}

// 쓰기 뒤 화면용 작업을 다시 읽는다. 보관된 작업도 읽는다(보관 직후 결과)
async function readItems(supabase: Client, ids: string[]): Promise<ActionResult<TaskItem[]>> {
  if (ids.length === 0) return ok([]);
  const { items, error } = await selectTaskItems(supabase, { ids, includeArchived: true });
  if (error) return dbErr("작업 다시 읽기", error);
  return ok(items);
}

async function readItem(supabase: Client, id: string): Promise<ActionResult<TaskItem>> {
  const r = await readItems(supabase, [id]);
  if (!r.ok) return r;
  return r.data[0] ? ok(r.data[0]) : err(taskErrorMessage({ code: "PGRST116", message: "" }));
}

// ─────────────────────────────────────────────
// 작업
// ─────────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskItem>> {
  return run("작업 생성", async ({ supabase }) => {
    const { data, error } = await supabase.rpc("create_task", {
      p_project: uuid(input.projectId),
      p_title: title(input.title),
      p_status: input.status === undefined ? undefined : oneOf(STATUS_ORDER, input.status),
      p_priority: input.priority === undefined ? undefined : oneOf(PRIORITY_ORDER, input.priority),
      p_assignee: input.assigneeId == null ? undefined : uuid(input.assigneeId),
      p_start: input.start == null ? undefined : optDate(input.start)!,
      p_due: input.due == null ? undefined : optDate(input.due)!,
      p_labels: input.labels === undefined ? undefined : labels(input.labels),
      p_desc: input.descriptionHtml == null ? undefined : (description(input.descriptionHtml) ?? undefined),
      p_estimate: input.estimate == null ? undefined : optEstimate(input.estimate)!,
      p_recur: input.recur === undefined ? undefined : oneOf(REPEATS, input.recur),
      p_sort_order: input.sortOrder == null ? undefined : sortOrder(input.sortOrder),
    });
    if (error) return dbErr("작업 생성", error);
    return readItem(supabase, data.id);
  });
}

export async function updateTask(id: string, patch: TaskPatch): Promise<ActionResult<TaskItem>> {
  return run("작업 수정", async ({ supabase }) => {
    const taskId = uuid(id);
    const row: TablesUpdate<"tasks"> = {};
    if (patch.title !== undefined) row.title = title(patch.title);
    if (patch.priority !== undefined) row.priority = oneOf(PRIORITY_ORDER, patch.priority);
    if (patch.assigneeId !== undefined) row.assignee_id = optUuid(patch.assigneeId);
    if (patch.start !== undefined) row.start_date = optDate(patch.start);
    if (patch.due !== undefined) row.due_date = optDate(patch.due);
    if (patch.labels !== undefined) row.labels = labels(patch.labels);
    if (patch.estimate !== undefined) row.estimate = optEstimate(patch.estimate);
    if (patch.recur !== undefined) row.recur = oneOf(REPEATS, patch.recur);
    if (patch.descriptionHtml !== undefined) row.description_html = description(patch.descriptionHtml);
    if (patch.sortOrder !== undefined) row.sort_order = sortOrder(patch.sortOrder);
    if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
    if (Object.keys(row).length === 0) return readItem(supabase, taskId);

    const { data, error } = await supabase
      .from("tasks")
      .update(row)
      .eq("id", taskId)
      .is("deleted_at", null)
      .select("id");
    if (error) return dbErr("작업 수정", error);
    // RLS가 권한 없는 행을 건너뛰면 0행이다
    if (data.length === 0) return err(taskErrorMessage({ code: "P0001", message: "not_found" }));
    return readItem(supabase, taskId);
  });
}

// 이미 다음 회차가 있는 원본 작업 id. 회차 생성은 기존 회차를 돌려주므로(다시 열었다가 다시 완료)
// 완료 전에 읽어 두고, 이번 호출로 새로 생긴 회차만 알린다
async function sourcesWithNext(
  supabase: Client,
  ids: string[],
): Promise<{ data: Set<string>; error: null } | { data: null; error: DbError }> {
  const { data, error } = await supabase.from("tasks").select("recur_source_id").in("recur_source_id", ids);
  if (error) return { data: null, error };
  return { data: new Set(data.flatMap((t) => (t.recur_source_id ? [t.recur_source_id] : []))), error: null };
}

// 반복 작업 회차는 done이 되는 순간 트리거가 만든다. complete_task는 멱등이라 회차 정보만 다시 받아 온다.
// hadNext면 회차가 완료 전부터 있었으므로 next를 비운다
async function finishComplete(
  supabase: Client,
  taskId: string,
  hadNext: boolean,
): Promise<ActionResult<CompleteResult>> {
  const { data, error } = await supabase.rpc("complete_task", { p_task: taskId });
  if (error) return dbErr("작업 완료", error);
  const nextId = hadNext ? null : (data[0]?.next_task_id ?? null);
  const items = await readItems(supabase, nextId ? [taskId, nextId] : [taskId]);
  if (!items.ok) return items;
  const item = items.data.find((t) => t.id === taskId);
  if (!item) return err(taskErrorMessage({ code: "PGRST116", message: "" }));
  return ok({ item, next: items.data.find((t) => t.id === nextId) ?? null });
}

export async function moveTask(id: string, status: TaskStatus, order?: number): Promise<ActionResult<CompleteResult>> {
  return run("작업 이동", async ({ supabase }) => {
    const taskId = uuid(id);
    // done으로 옮기면 move_task 안에서 회차가 생기므로 그 전에 확인한다
    const before = status === "done" ? await sourcesWithNext(supabase, [taskId]) : null;
    if (before?.error) return dbErr("반복 회차 읽기", before.error);
    const { error } = await supabase.rpc("move_task", {
      p_task: taskId,
      p_status: oneOf(STATUS_ORDER, status),
      p_sort_order: order === undefined ? undefined : sortOrder(order),
    });
    if (error) return dbErr("작업 이동", error);
    if (before) return finishComplete(supabase, taskId, before.data.has(taskId));
    const item = await readItem(supabase, taskId);
    return item.ok ? ok({ item: item.data, next: null }) : item;
  });
}

export async function completeTask(id: string): Promise<ActionResult<CompleteResult>> {
  return run("작업 완료", async ({ supabase }) => {
    const taskId = uuid(id);
    const before = await sourcesWithNext(supabase, [taskId]);
    if (before.error) return dbErr("반복 회차 읽기", before.error);
    return finishComplete(supabase, taskId, before.data.has(taskId));
  });
}

export async function reopenTask(id: string): Promise<ActionResult<TaskItem>> {
  return run("완료 취소", async ({ supabase }) => {
    const taskId = uuid(id);
    const { error } = await supabase.rpc("reopen_task", { p_task: taskId });
    if (error) return dbErr("완료 취소", error);
    return readItem(supabase, taskId);
  });
}

// 토큰은 RPC가 준 updated_at 문자열 그대로 돌려준다
export async function deleteTask(id: string): Promise<ActionResult<DeleteResult>> {
  return run("작업 삭제", async ({ supabase }) => {
    const { data, error } = await supabase.rpc("soft_delete_task", { p_task: uuid(id) });
    if (error) return dbErr("작업 삭제", error);
    return ok({ token: data });
  });
}

export async function restoreTask(id: string, token: string): Promise<ActionResult<TaskItem>> {
  return run("작업 복원", async ({ supabase }) => {
    const taskId = uuid(id);
    if (typeof token !== "string" || token === "") throw new InputError();
    const { error } = await supabase.rpc("restore_task", { p_task: taskId, p_token: token });
    if (error) return dbErr("작업 복원", error);
    return readItem(supabase, taskId);
  });
}

export async function bulkUpdate(ids: string[], patch: BulkPatch): Promise<ActionResult<BulkResult>> {
  return run("작업 일괄 수정", async ({ supabase }) => {
    const taskIds = uuids(ids);
    const row: TablesUpdate<"tasks"> = {};
    if (patch.status !== undefined) row.status = oneOf(STATUS_ORDER, patch.status);
    if (patch.assigneeId !== undefined) row.assignee_id = optUuid(patch.assigneeId);
    if (patch.priority !== undefined) row.priority = oneOf(PRIORITY_ORDER, patch.priority);
    if (Object.keys(row).length === 0) throw new InputError();
    const before = patch.status === "done" ? await sourcesWithNext(supabase, taskIds) : null;
    if (before?.error) return dbErr("반복 회차 읽기", before.error);

    const { data, error } = await supabase
      .from("tasks")
      .update(row)
      .in("id", taskIds)
      .is("deleted_at", null)
      .select("id");
    if (error) return dbErr("작업 일괄 수정", error);
    const done = new Set(data.map((t) => t.id));
    const updated = await readItems(supabase, [...done]);
    if (!updated.ok) return updated;

    // 일괄 완료로 새로 생긴 반복 회차(트리거가 만든다). 완료 전부터 있던 회차는 뺀다
    let created: TaskItem[] = [];
    const fresh = before ? [...done].filter((id) => !before.data.has(id)) : [];
    if (fresh.length > 0) {
      const next = await selectTaskItems(supabase, { recurSourceIds: fresh, includeArchived: true });
      if (next.error) return dbErr("반복 회차 읽기", next.error);
      created = next.items;
    }
    return ok({ updated: updated.data, created, failedIds: taskIds.filter((t) => !done.has(t)) });
  });
}

export async function bulkDelete(ids: string[]): Promise<ActionResult<BulkDeleteResult>> {
  return run("작업 일괄 삭제", async ({ supabase }) => {
    const taskIds = uuids(ids);
    const results = await Promise.all(
      taskIds.map(async (id) => ({ id, ...(await supabase.rpc("soft_delete_task", { p_task: id })) })),
    );
    const tokens: Record<string, string> = {};
    const failedIds: string[] = [];
    for (const r of results) {
      if (r.error) {
        console.error("[작업 일괄 삭제]", r.id, r.error.code, r.error.message);
        failedIds.push(r.id);
      } else {
        tokens[r.id] = r.data;
      }
    }
    if (failedIds.length === taskIds.length) return dbErr("작업 일괄 삭제", results[0].error!);
    return ok({ tokens, failedIds });
  });
}

// 일괄 삭제 실행 취소. 실패한 작업은 failedIds로, 그중 토큰이 맞지 않는(삭제 뒤 바뀐) 작업은 conflictIds로도 돌려준다.
// 권한·네트워크 같은 다른 실패는 첫 오류의 문구를 error로 돌려준다
export async function bulkRestore(tokens: Record<string, string>): Promise<ActionResult<BulkRestoreResult>> {
  return run("작업 일괄 복원", async ({ supabase }) => {
    const ids = uuids(Object.keys(tokens ?? {}));
    if (ids.some((id) => typeof tokens[id] !== "string" || tokens[id] === "")) throw new InputError();
    const results = await Promise.all(
      ids.map(async (id) => ({ id, ...(await supabase.rpc("restore_task", { p_task: id, p_token: tokens[id] })) })),
    );
    const restoredIds: string[] = [];
    const conflictIds: string[] = [];
    const failedIds: string[] = [];
    let error: string | null = null;
    for (const r of results) {
      if (!r.error) {
        restoredIds.push(r.id);
        continue;
      }
      failedIds.push(r.id);
      if (r.error.code === "P0001" && r.error.message === "conflict") {
        conflictIds.push(r.id);
      } else {
        console.error("[작업 일괄 복원]", r.id, r.error.code, r.error.message);
        error ??= taskErrorMessage(r.error);
      }
    }
    const restored = await readItems(supabase, restoredIds);
    if (!restored.ok) return restored;
    return ok({ restored: restored.data, failedIds, conflictIds, error });
  });
}

// ─────────────────────────────────────────────
// 뷰 상태
// ─────────────────────────────────────────────

export async function saveViewState(workspaceId: string, viewKey: ViewKey, state: unknown): Promise<ActionResult<null>> {
  return run("뷰 설정 저장", async ({ supabase, uid }) => {
    const ws = uuid(workspaceId);
    if (typeof viewKey !== "string" || !isViewKey(viewKey)) throw new InputError();
    const { error } = await supabase
      .from("user_view_states")
      .upsert(
        { user_id: uid, workspace_id: ws, view_key: viewKey, state: parseViewState(state) },
        { onConflict: "user_id,workspace_id,view_key" },
      );
    if (error) return dbErr("뷰 설정 저장", error);
    return ok(null);
  });
}

// ─────────────────────────────────────────────
// 드로어 상세·서브태스크·의존성
// ─────────────────────────────────────────────

export async function loadTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>> {
  return run("작업 상세", async ({ supabase }) => {
    const { data, error } = await selectTaskDetail(supabase, uuid(taskId));
    if (error) return dbErr("작업 상세", error);
    return ok(data);
  });
}

// 정렬값을 주지 않으면 맨 뒤(+1000)에 둔다
export async function createSubtask(
  taskId: string,
  subtaskTitle: string,
  opts: { assigneeId?: string | null; due?: string | null; sortOrder?: number } = {},
): Promise<ActionResult<Subtask>> {
  return run("서브태스크 추가", async ({ supabase }) => {
    const parent = uuid(taskId);
    let order = opts.sortOrder === undefined ? null : sortOrder(opts.sortOrder);
    if (order === null) {
      const last = await supabase
        .from("subtasks")
        .select("sort_order")
        .eq("task_id", parent)
        .order("sort_order", { ascending: false })
        .limit(1);
      if (last.error) return dbErr("서브태스크 추가", last.error);
      order = Number(last.data[0]?.sort_order ?? 0) + 1000;
    }
    const { data, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: parent,
        title: title(subtaskTitle),
        assignee_id: opts.assigneeId == null ? null : uuid(opts.assigneeId),
        due_date: opts.due == null ? null : optDate(opts.due),
        sort_order: order,
      })
      .select("*")
      .single();
    if (error) return dbErr("서브태스크 추가", error);
    return ok(data);
  });
}

export async function updateSubtask(id: string, patch: SubtaskPatch): Promise<ActionResult<Subtask>> {
  return run("서브태스크 수정", async ({ supabase }) => {
    const subId = uuid(id);
    const row: TablesUpdate<"subtasks"> = {};
    if (patch.title !== undefined) row.title = title(patch.title);
    if (patch.done !== undefined) {
      if (typeof patch.done !== "boolean") throw new InputError();
      row.done = patch.done;
    }
    if (patch.assigneeId !== undefined) row.assignee_id = optUuid(patch.assigneeId);
    if (patch.due !== undefined) row.due_date = optDate(patch.due);
    if (patch.note !== undefined) {
      if (patch.note !== null && (typeof patch.note !== "string" || patch.note.length > 10_000)) throw new InputError();
      row.note = patch.note?.trim() ? patch.note : null;
    }
    if (patch.sortOrder !== undefined) row.sort_order = sortOrder(patch.sortOrder);
    if (Object.keys(row).length === 0) throw new InputError();
    const { data, error } = await supabase.from("subtasks").update(row).eq("id", subId).select("*");
    if (error) return dbErr("서브태스크 수정", error);
    if (!data[0]) return err(taskErrorMessage({ code: "P0001", message: "not_found" }));
    return ok(data[0]);
  });
}

export async function toggleSubtask(id: string, done: boolean): Promise<ActionResult<Subtask>> {
  return updateSubtask(id, { done });
}

export async function deleteSubtask(id: string): Promise<ActionResult<{ id: string }>> {
  return run("서브태스크 삭제", async ({ supabase }) => {
    const subId = uuid(id);
    const { data, error } = await supabase.from("subtasks").delete().eq("id", subId).select("id");
    if (error) return dbErr("서브태스크 삭제", error);
    if (!data[0]) return err(taskErrorMessage({ code: "P0001", message: "not_found" }));
    return ok({ id: subId });
  });
}

// 서브태스크를 같은 프로젝트의 새 작업으로 바꾼다. 결과는 새 작업
export async function convertSubtask(id: string): Promise<ActionResult<TaskItem>> {
  return run("서브태스크 변환", async ({ supabase }) => {
    const { data, error } = await supabase.rpc("convert_subtask", { p_subtask: uuid(id) });
    if (error) return dbErr("서브태스크 변환", error);
    return readItem(supabase, data.id);
  });
}

async function readDeps(supabase: Client, taskId: string): Promise<ActionResult<{ blockedBy: string[] }>> {
  const { data, error } = await supabase.from("task_deps").select("blocked_by_id").eq("task_id", taskId);
  if (error) return dbErr("선행 작업 읽기", error);
  return ok({ blockedBy: data.map((d) => d.blocked_by_id) });
}

export async function addDependency(taskId: string, blockedById: string): Promise<ActionResult<{ blockedBy: string[] }>> {
  return run("선행 작업 추가", async ({ supabase }) => {
    const task = uuid(taskId);
    const blocked = uuid(blockedById);
    if (task === blocked) throw new InputError();
    const { error } = await supabase.from("task_deps").insert({ task_id: task, blocked_by_id: blocked });
    // 이미 있는 의존성은 성공으로 본다
    if (error && error.code !== "23505") return dbErr("선행 작업 추가", error);
    return readDeps(supabase, task);
  });
}

export async function removeDependency(
  taskId: string,
  blockedById: string,
): Promise<ActionResult<{ blockedBy: string[] }>> {
  return run("선행 작업 제거", async ({ supabase }) => {
    const task = uuid(taskId);
    const { error } = await supabase
      .from("task_deps")
      .delete()
      .eq("task_id", task)
      .eq("blocked_by_id", uuid(blockedById));
    if (error) return dbErr("선행 작업 제거", error);
    return readDeps(supabase, task);
  });
}
