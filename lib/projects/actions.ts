"use server";
// 프로젝트·보관함 Server Action. 생성·편집·보관·삭제·복원·영구 삭제, 즐겨찾기, 구성원 권한, 마일스톤.
// 매번 검증된 클레임으로 사용자를 확인하고 입력을 다시 검증한 뒤 RLS가 걸린 세션 클라이언트로만 쓴다.
// 성공하면 refresh로 셸(사이드바 프로젝트 목록·★)과 현재 화면을 새로 그린다
import { refresh } from "next/cache";
import { PROJECT_COLORS, PROJECT_ICON_LABELS } from "@/lib/i18n/labels";
import type { MessageKey } from "@/lib/i18n/messages/types";
import { getT } from "@/lib/i18n/server";
import type { T as Translate } from "@/lib/i18n/t";
import { projectErrorMessage } from "@/lib/projects/errors";
import type { CreateProjectInput, ProjectPatch, SharePerm, TrashKind } from "@/lib/projects/types";
import { isIsoDate } from "@/lib/schedule/dates";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/database.types";
import { getWorkspaceMembers } from "@/lib/tasks/queries";
import type { ActionResult, WorkspaceMember } from "@/lib/tasks/types";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };
type Session = { supabase: Client; uid: string; t: Translate };

const BUCKET = "files";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["planning", "active", "risk", "hold", "complete"] as const;
const ACCESS = ["workspace", "private"] as const;
const PERMS = ["view", "comment", "edit", "full"] as const;
const ICONS = Object.keys(PROJECT_ICON_LABELS);
const COLORS = Object.keys(PROJECT_COLORS);
const NAME_MAX = 120;
const DESC_MAX = 5000;
// Storage remove 한 번에 보내는 경로 수
const REMOVE_CHUNK = 100;
// 파일 목록을 나눠 읽는 단위. PostgREST 기본 최대 행 수와 같다
const FILE_PAGE = 1000;

class InputError extends Error {}
// 권한·상태 판정으로 멈출 때. 화면 문구는 run이 이 사전 키로 만든다
class StopError extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function err<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

async function dbErr<T>(what: string, error: DbError): Promise<ActionResult<T>> {
  console.error(`[${what}]`, error.code, error.message);
  return err(projectErrorMessage(error, await getT()));
}

// Server Action은 직접 POST로도 불릴 수 있다. 매번 검증된 클레임으로 사용자를 확인한다
async function session(): Promise<Omit<Session, "t"> | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  return uid ? { supabase, uid } : null;
}

// 검증 실패와 예상하지 못한 예외를 결과로 바꾼다. 실패를 빈 성공으로 숨기지 않는다
async function run<T>(what: string, body: (s: Session) => Promise<ActionResult<T>>) {
  const t = await getT();
  try {
    const s = await session();
    if (!s) return err<T>(t("errors.msg.sessionExpired"));
    return await body({ ...s, t });
  } catch (e) {
    if (e instanceof InputError) return err<T>(t("errors.rpc.invalidInput"));
    if (e instanceof StopError) return err<T>((t as (key: string) => string)(e.key));
    console.error(`[${what}]`, e);
    return err<T>(projectErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t));
  }
}

// ─────────────────────────────────────────────
// 입력 검증(신뢰 경계). 틀리면 InputError
// ─────────────────────────────────────────────

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new InputError();
  return value;
}

function optUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T {
  if (typeof value !== "string" || !(list as readonly string[]).includes(value)) throw new InputError();
  return value as T;
}

function name(value: unknown, max = NAME_MAX): string {
  if (typeof value !== "string") throw new InputError();
  const v = value.trim();
  if (!v || v.length > max) throw new InputError();
  return v;
}

function optText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > DESC_MAX) throw new InputError();
  return value.trim() || null;
}

function optDate(value: unknown): string | null {
  if (value === null) return null;
  if (!isIsoDate(value)) throw new InputError();
  return value;
}

function token(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) throw new InputError();
  return value;
}

// ─────────────────────────────────────────────
// 판정 보조
// ─────────────────────────────────────────────

async function projectWorkspace(supabase: Client, projectId: string) {
  const { data, error } = await supabase.from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new StopError("projects.errors.notFound");
  return data.workspace_id;
}

// 리드·구성원으로 넣을 사람은 그 워크스페이스의 활성·초대 구성원이어야 한다.
// lead_id·project_members.user_id는 profiles만 참조해 DB가 소속을 보지 않는다
async function requireMember(supabase: Client, workspaceId: string, userId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status === "deactivated") throw new StopError("projects.errors.inactiveMember");
}

async function requireManage(supabase: Client, projectId: string) {
  const { data, error } = await supabase.rpc("project_perm", { p: projectId });
  if (error) throw error;
  if (data !== "full") throw new StopError("projects.errors.forbidden");
}

// 갱신 결과가 0행이면 RLS가 막은 것이다(오류 없이 0행을 돌려준다)
function forbiddenIfEmpty(rows: unknown[]) {
  if (rows.length === 0) throw new StopError("projects.errors.forbidden");
}

// Storage 객체를 지운다. remove는 RLS가 거부한 경로를 오류 없이 건너뛰고 응답에서만 빼므로,
// 응답에 없는 경로는 exists로 다시 확인해 아직 있으면 실패로 본다(올라가지 않은 pending 행은 객체가 없어 통과).
// 하나라도 남으면 false. 호출자는 그때 purge를 부르지 않는다
async function removeObjects(supabase: Client, paths: readonly string[]) {
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    const { data, error } = await supabase.storage.from(BUCKET).remove([...chunk]);
    if (error) {
      console.error("[Storage 삭제]", error.message);
      return false;
    }
    const removed = new Set(data.map((o) => o.name));
    for (const path of chunk) {
      if (removed.has(path)) continue;
      const { data: still } = await supabase.storage.from(BUCKET).exists(path);
      if (still) {
        console.error("[Storage 삭제] 남은 객체", path);
        return false;
      }
    }
  }
  return true;
}

// ─────────────────────────────────────────────
// 프로젝트 생성·편집
// ─────────────────────────────────────────────

// 키는 create_project가 이름 이니셜로 정하고 겹치면 X를 붙인다(META §4)
export async function createProject(input: CreateProjectInput): Promise<ActionResult<{ id: string; key: string }>> {
  return run("프로젝트 생성", async ({ supabase }) => {
    if (!input || typeof input !== "object") throw new InputError();
    const workspaceId = uuid(input.workspaceId);
    const lead = optUuid(input.leadId);
    if (lead) await requireMember(supabase, workspaceId, lead);
    const { data, error } = await supabase.rpc("create_project", {
      p_workspace: workspaceId,
      p_name: name(input.name),
      p_icon: oneOf(ICONS, input.icon),
      p_color: oneOf(COLORS, input.color),
      p_access: oneOf(ACCESS, input.access),
      p_lead: lead ?? undefined,
      p_description: optText(input.description) ?? undefined,
    });
    if (error) return dbErr("프로젝트 생성", error);
    refresh();
    return ok({ id: data.id, key: data.key });
  });
}

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<ActionResult<null>> {
  return run("프로젝트 수정", async ({ supabase, t }) => {
    const id = uuid(projectId);
    if (!patch || typeof patch !== "object") throw new InputError();
    const row: TablesUpdate<"projects"> = {};
    if ("status" in patch) row.status = oneOf(STATUSES, patch.status);
    if ("startDate" in patch) row.start_date = optDate(patch.startDate);
    if ("dueDate" in patch) row.due_date = optDate(patch.dueDate);
    if ("description" in patch) row.description = optText(patch.description);
    if ("access" in patch) row.access = oneOf(ACCESS, patch.access);
    if ("leadId" in patch) {
      row.lead_id = optUuid(patch.leadId);
      if (row.lead_id) await requireMember(supabase, await projectWorkspace(supabase, id), row.lead_id);
    }
    if (Object.keys(row).length === 0) throw new InputError();
    if (row.start_date && row.due_date && row.start_date > row.due_date) {
      return err(t("projects.errors.startAfterDue"));
    }
    const { data, error } = await supabase.from("projects").update(row).eq("id", id).select("id");
    if (error) return dbErr("프로젝트 수정", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

// 보관·보관 해제. archived_at은 관리 권한자가 직접 바꾼다(복원 토큰 대상이 아니다)
export async function setProjectArchived(projectId: string, archived: boolean): Promise<ActionResult<null>> {
  return run("프로젝트 보관", async ({ supabase }) => {
    const id = uuid(projectId);
    if (typeof archived !== "boolean") throw new InputError();
    const { data, error } = await supabase
      .from("projects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");
    if (error) return dbErr("프로젝트 보관", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

export async function setProjectFavorite(workspaceId: string, projectId: string, on: boolean): Promise<ActionResult<boolean>> {
  return run("프로젝트 즐겨찾기", async ({ supabase, uid }) => {
    const ws = uuid(workspaceId);
    const id = uuid(projectId);
    if (typeof on !== "boolean") throw new InputError();
    const { error } = on
      ? await supabase.from("favorites").insert({ user_id: uid, workspace_id: ws, project_id: id })
      : await supabase.from("favorites").delete().eq("user_id", uid).eq("project_id", id);
    // 이미 즐겨찾기한 프로젝트는 성공으로 본다
    if (error && error.code !== "23505") return dbErr("프로젝트 즐겨찾기", error);
    refresh();
    return ok(on);
  });
}

// 즐겨찾기 화면의 해제. 프로젝트·작업 어느 쪽이든 본인 행 id로 지운다(RLS가 본인 행만 허용)
export async function removeFavorite(favoriteId: string): Promise<ActionResult<null>> {
  return run("즐겨찾기 해제", async ({ supabase, uid }) => {
    const { error } = await supabase.from("favorites").delete().eq("id", uuid(favoriteId)).eq("user_id", uid);
    if (error) return dbErr("즐겨찾기 해제", error);
    refresh();
    return ok(null);
  });
}

// ─────────────────────────────────────────────
// 프로젝트 구성원 권한. 쓰기는 관리 권한자만(RLS), 자기 권한 상승은 DB 트리거가 막는다
// ─────────────────────────────────────────────

export async function addProjectMember(projectId: string, userId: string, perm: SharePerm): Promise<ActionResult<null>> {
  return run("프로젝트 구성원 추가", async ({ supabase, t }) => {
    const id = uuid(projectId);
    const user = uuid(userId);
    const p = oneOf(PERMS, perm);
    await requireMember(supabase, await projectWorkspace(supabase, id), user);
    const { error } = await supabase.from("project_members").insert({ project_id: id, user_id: user, perm: p });
    if (error) {
      if (error.code === "23505") return err(t("projects.errors.alreadyMember"));
      return dbErr("프로젝트 구성원 추가", error);
    }
    refresh();
    return ok(null);
  });
}

export async function setProjectMemberPerm(projectId: string, userId: string, perm: SharePerm): Promise<ActionResult<null>> {
  return run("프로젝트 권한 변경", async ({ supabase }) => {
    const { data, error } = await supabase
      .from("project_members")
      .update({ perm: oneOf(PERMS, perm) })
      .eq("project_id", uuid(projectId))
      .eq("user_id", uuid(userId))
      .select("user_id");
    if (error) return dbErr("프로젝트 권한 변경", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ActionResult<null>> {
  return run("프로젝트 구성원 제거", async ({ supabase }) => {
    const { data, error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", uuid(projectId))
      .eq("user_id", uuid(userId))
      .select("user_id");
    if (error) return dbErr("프로젝트 구성원 제거", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

// ─────────────────────────────────────────────
// 마일스톤. 편집 권한자가 직접 쓴다(milestones RLS can_edit_project_rows)
// ─────────────────────────────────────────────

export async function createMilestone(projectId: string, title: string, date: string): Promise<ActionResult<null>> {
  return run("마일스톤 추가", async ({ supabase }) => {
    const d = optDate(date);
    if (!d) throw new InputError();
    const { error } = await supabase.from("milestones").insert({ project_id: uuid(projectId), name: name(title), date: d });
    if (error) return dbErr("마일스톤 추가", error);
    refresh();
    return ok(null);
  });
}

export async function updateMilestone(milestoneId: string, title: string, date: string): Promise<ActionResult<null>> {
  return run("마일스톤 수정", async ({ supabase }) => {
    const d = optDate(date);
    if (!d) throw new InputError();
    const { data, error } = await supabase
      .from("milestones")
      .update({ name: name(title), date: d })
      .eq("id", uuid(milestoneId))
      .select("id");
    if (error) return dbErr("마일스톤 수정", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult<null>> {
  return run("마일스톤 삭제", async ({ supabase }) => {
    const { data, error } = await supabase.from("milestones").delete().eq("id", uuid(milestoneId)).select("id");
    if (error) return dbErr("마일스톤 삭제", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

// ─────────────────────────────────────────────
// 삭제·복원·영구 삭제
// ─────────────────────────────────────────────

// 소프트 삭제. 돌려받은 토큰(updated_at 문자열)을 그대로 restoreTrashItem에 넘긴다
export async function deleteProject(projectId: string): Promise<ActionResult<{ token: string }>> {
  return run("프로젝트 삭제", async ({ supabase }) => {
    const { data, error } = await supabase.rpc("soft_delete_project", { p_project: uuid(projectId) });
    if (error) return dbErr("프로젝트 삭제", error);
    refresh();
    return ok({ token: data });
  });
}

const RESTORE = {
  project: (s: Client, id: string, t: string) => s.rpc("restore_project", { p_project: id, p_token: t }),
  task: (s: Client, id: string, t: string) => s.rpc("restore_task", { p_task: id, p_token: t }),
  comment: (s: Client, id: string, t: string) => s.rpc("restore_comment", { p_comment: id, p_token: t }),
  file: (s: Client, id: string, t: string) => s.rpc("restore_file", { p_file: id, p_token: t }),
} as const;
const KINDS = Object.keys(RESTORE) as TrashKind[];

// 휴지통 복원. 삭제 뒤 다른 사람이 바꿨으면 DB가 conflict로 거부하고 덮어쓰지 않는다
export async function restoreTrashItem(kind: TrashKind, id: string, restoreToken: string): Promise<ActionResult<null>> {
  return run("복원", async ({ supabase }) => {
    const { error } = await RESTORE[oneOf(KINDS, kind)](supabase, uuid(id), token(restoreToken));
    if (error) return dbErr("복원", error);
    refresh();
    return ok(null);
  });
}

// 보관 해제. 보관(archived_at)은 토큰 없이 직접 바꾼다. 프로젝트는 관리 권한, 작업은 편집 권한(RLS)
export async function unarchiveItem(kind: "project" | "task", id: string): Promise<ActionResult<null>> {
  return run("보관 해제", async ({ supabase }) => {
    const table = oneOf(["project", "task"] as const, kind) === "project" ? "projects" : "tasks";
    const { data, error } = await supabase.from(table).update({ archived_at: null }).eq("id", uuid(id)).select("id");
    if (error) return dbErr("보관 해제", error);
    forbiddenIfEmpty(data);
    refresh();
    return ok(null);
  });
}

// 영구 삭제. 되돌릴 수 없다. 관리 권한자만.
// 파일·프로젝트는 Storage 객체를 세션 클라이언트로 먼저 지우고, 하나라도 남으면 purge를 부르지 않는다
export async function purgeTrashItem(kind: TrashKind, id: string): Promise<ActionResult<null>> {
  return run("영구 삭제", async ({ supabase, t }) => {
    const k = oneOf(KINDS, kind);
    const target = uuid(id);
    let error: DbError | null = null;
    if (k === "project") {
      await requireManage(supabase, target);
      const { data: p, error: pe } = await supabase.from("projects").select("deleted_at").eq("id", target).maybeSingle();
      if (pe) return dbErr("영구 삭제", pe);
      if (!p?.deleted_at) return dbErr("영구 삭제", { code: "P0001", message: "invalid_state" });
      // 삭제된 프로젝트의 파일 행은 편집 권한자에게 보인다. 상태·삭제 여부와 관계없이 전부 지운다.
      // PostgREST는 한 번에 최대 1000행만 주므로 id 순으로 끝까지 나눠 읽는다
      const paths: string[] = [];
      for (let from = 0; ; from += FILE_PAGE) {
        const { data: files, error: fe } = await supabase
          .from("files")
          .select("storage_path")
          .eq("project_id", target)
          .order("id")
          .range(from, from + FILE_PAGE - 1);
        if (fe) return dbErr("영구 삭제 파일 목록", fe);
        paths.push(...files.map((f) => f.storage_path));
        if (files.length < FILE_PAGE) break;
      }
      if (!(await removeObjects(supabase, paths))) return err(t("projects.errors.storageRemoveFailed"));
      ({ error } = await supabase.rpc("purge_project", { p_project: target }));
    } else if (k === "file") {
      const { data: f, error: fe } = await supabase
        .from("files")
        .select("project_id, storage_path, deleted_at")
        .eq("id", target)
        .maybeSingle();
      if (fe) return dbErr("영구 삭제", fe);
      if (!f) return dbErr("영구 삭제", { code: "P0001", message: "not_found" });
      if (!f.deleted_at) return dbErr("영구 삭제", { code: "P0001", message: "invalid_state" });
      await requireManage(supabase, f.project_id);
      if (!(await removeObjects(supabase, [f.storage_path]))) return err(t("projects.errors.storageRemoveFailed"));
      ({ error } = await supabase.rpc("purge_file", { p_file: target }));
    } else if (k === "task") {
      ({ error } = await supabase.rpc("purge_task", { p_task: target }));
    } else {
      ({ error } = await supabase.rpc("purge_comment", { p_comment: target }));
    }
    if (error) return dbErr("영구 삭제", error);
    refresh();
    return ok(null);
  });
}

// 새 프로젝트 대화상자의 리드 선택지. 비활성 구성원은 뺀다
export async function loadLeadOptions(workspaceId: string): Promise<ActionResult<WorkspaceMember[]>> {
  return run("리드 선택지", async () => {
    const members = await getWorkspaceMembers(uuid(workspaceId));
    return ok(members.filter((m) => m.status !== "deactivated"));
  });
}
