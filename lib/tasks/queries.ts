// 작업 화면용 서버 조회. 범위는 RLS가 자르고, 집계는 한 번의 임베드 조회와 구성원 조회 두 번으로 끝낸다
import "server-only";
import { cache } from "react";
import { sanitizeTaskHtml } from "@/lib/html/sanitize";
import { TASK_LABEL_LABELS } from "@/lib/i18n/labels";
import type { MessageKey } from "@/lib/i18n/messages/types";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { TaskDetail, TaskItem, ViewKey, ViewState, WorkspaceMember } from "@/lib/tasks/types";
import { parseViewState } from "@/lib/tasks/view";

type Client = Awaited<ReturnType<typeof createClient>>;

// FK가 여러 개인 관계는 이름으로 고른다(tasks→projects 복합 FK, task_deps→tasks 두 개, files→tasks 복합 FK)
const TASK_SELECT = `*,
  project:projects!tasks_project_id_workspace_id_fkey!inner(id, key, name, color, icon, deleted_at, archived_at),
  subtasks(done),
  comments(count),
  files!files_task_id_project_id_fkey(count),
  deps:task_deps!task_deps_task_id_fkey(blocked_by_id)`;

// 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
// what은 로그 태그, target은 화면에 보일 대상 이름이다
async function fail(
  what: string,
  target: Extract<MessageKey, `tasks.errors.loadTarget.${string}`>,
  error: { code?: string; message: string },
): Promise<never> {
  console.error(`[${what}]`, error.code, error.message);
  const t = await getT();
  throw new Error(t("tasks.errors.loadFailed", { what: t(target), error: taskErrorMessage(error, t) }));
}

// 작업 목록 조회. 삭제된 작업·삭제된 프로젝트의 작업은 빼고, 목록 조회에서는 보관된 작업·보관된 프로젝트도 뺀다.
// 댓글은 삭제되지 않은 것만, 첨부는 업로드가 끝난(ready) 것만 센다.
// shortcut: PostgREST max_rows(1000)를 넘는 작업은 잘린다. 워크스페이스 작업이 1000개를 넘으면 페이지 조회로 바꾼다
export async function selectTaskItems(
  supabase: Client,
  where: {
    workspaceId?: string;
    projectId?: string;
    ids?: string[];
    key?: string;
    recurSourceIds?: string[];
    includeArchived?: boolean;
  },
): Promise<{ items: TaskItem[]; error: null } | { items: null; error: { code?: string; message: string } }> {
  let q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .is("project.deleted_at", null)
    .is("comments.deleted_at", null)
    .eq("files.status", "ready")
    .is("files.deleted_at", null);
  if (!where.includeArchived) q = q.is("archived_at", null).is("project.archived_at", null);
  if (where.workspaceId) q = q.eq("workspace_id", where.workspaceId);
  if (where.projectId) q = q.eq("project_id", where.projectId);
  if (where.ids) q = q.in("id", where.ids);
  if (where.key) q = q.eq("key", where.key);
  if (where.recurSourceIds) q = q.in("recur_source_id", where.recurSourceIds);

  const [tasks, members] = await Promise.all([
    q.order("sort_order"),
    where.workspaceId ? membersOf(where.workspaceId) : null,
  ]);
  if (tasks.error) return { items: null, error: tasks.error };
  // 편집 권한은 작업마다가 아니라 결과에 나온 프로젝트마다 한 번 묻는다
  const projectIds = [...new Set(tasks.data.map((t) => t.project_id))];
  const perms = await Promise.all(projectIds.map((id) => canEditProject(id)));
  const permError = perms.find((r) => r.error)?.error;
  if (permError) return { items: null, error: permError };
  const editable = new Set(projectIds.filter((_, i) => perms[i].data === true));
  let memberRows = members;
  // 워크스페이스를 모르는 조회(id·회차)는 작업의 워크스페이스로 구성원을 읽는다
  if (!memberRows) {
    const ws = tasks.data[0]?.workspace_id;
    memberRows = ws ? await membersOf(ws) : { data: [], error: null };
  }
  if (memberRows.error) return { items: null, error: memberRows.error };

  const t = await getT();
  const byId = new Map(memberRows.data.map((m) => [m.id, m]));
  const items = tasks.data.map(({ project, subtasks, comments, files, deps, ...row }): TaskItem => {
    const member = row.assignee_id ? byId.get(row.assignee_id) : undefined;
    return {
      ...row,
      description_html: row.description_html ? sanitizeTaskHtml(row.description_html) : null,
      assignee: row.assignee_id
        ? { id: row.assignee_id, name: member?.name ?? t("common.unknownUser"), color: member?.color ?? "slate" }
        : null,
      project: { id: project.id, key: project.key, name: project.name, color: project.color, icon: project.icon },
      subtaskDone: subtasks.filter((s) => s.done).length,
      subtaskTotal: subtasks.length,
      commentCount: comments[0]?.count ?? 0,
      attachmentCount: files[0]?.count ?? 0,
      blockedBy: deps.map((d) => d.blocked_by_id),
      canEdit: editable.has(row.project_id),
    };
  });
  return { items, error: null };
}

async function selectMembers(
  supabase: Client,
  workspaceId: string,
): Promise<{ data: WorkspaceMember[]; error: null } | { data: null; error: { code?: string; message: string } }> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, status, title, color, profiles(name, email, color)")
    .eq("workspace_id", workspaceId);
  if (error) return { data: null, error };
  const t = await getT();
  return {
    data: data
      .map((m) => ({
        id: m.user_id,
        name: m.profiles?.name || m.profiles?.email || t("common.namelessMember"),
        email: m.profiles?.email ?? "",
        color: m.color ?? m.profiles?.color ?? "indigo",
        role: m.role,
        status: m.status,
        title: m.title,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    error: null,
  };
}

// 한 요청 안에서 작업 목록과 담당자 선택지가 같은 구성원 조회를 한 번만 쓰게 묶는다.
// 서버 클라이언트는 호출마다 새로 만들어지므로 클라이언트를 인자로 받지 않고 workspaceId 하나를 키로 쓴다
const membersOf = cache(async (workspaceId: string) => selectMembers(await createClient(), workspaceId));

// 프로젝트 편집 권한(can_edit_project). 한 요청 안의 페이지·액션이 같은 프로젝트를 다시 묻지 않게 묶는다
export const canEditProject = cache(async (projectId: string) =>
  (await createClient()).rpc("can_edit_project", { p: projectId }),
);

export async function getTaskItems(
  scope: { workspaceId: string } | { workspaceId: string; projectId: string },
): Promise<TaskItem[]> {
  const supabase = await createClient();
  const { items, error } = await selectTaskItems(supabase, {
    workspaceId: scope.workspaceId,
    projectId: "projectId" in scope ? scope.projectId : undefined,
  });
  if (error) return fail("작업 목록", "tasks.errors.loadTarget.taskList", error);
  return items;
}

// 키(WEB-112)는 워크스페이스 안에서 유일하다. 드로어는 보관된 작업도 열 수 있다
export async function getTaskItemByKey(workspaceId: string, key: string): Promise<TaskItem | null> {
  if (!/^[A-Z][A-Z0-9]{0,9}-\d+$/.test(key)) return null;
  const supabase = await createClient();
  const { items, error } = await selectTaskItems(supabase, { workspaceId, key, includeArchived: true });
  if (error) return fail("작업", "tasks.errors.loadTarget.task", error);
  return items[0] ?? null;
}

// 저장된 값이 없거나 손상됐으면 기본값을 돌려준다. RLS가 본인 행만 보인다
export async function getViewState(workspaceId: string, viewKey: ViewKey): Promise<ViewState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_view_states")
    .select("state")
    .eq("workspace_id", workspaceId)
    .eq("view_key", viewKey)
    .maybeSingle();
  if (error) return fail("뷰 설정", "tasks.errors.loadTarget.viewState", error);
  if (data) return parseViewState(data.state);
  // 저장된 값이 없으면 환경 설정의 "보드에 완료 열 표시"가 초기값이다. 툴바에서 바꾸면 저장된 값이 우선한다
  const { data: prefs } = await supabase
    .from("user_prefs")
    .select("show_done_board")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return { ...parseViewState(null), showDone: prefs?.show_done_board ?? true };
}

// 담당자 선택용. 비활성 구성원은 뺀다
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await membersOf(workspaceId);
  if (error) return fail("구성원 목록", "tasks.errors.loadTarget.members", error);
  return data.filter((m) => m.status !== "deactivated");
}

// 라벨 선택지. tasks.labels는 check 제약으로 8종이 고정이라 조회하지 않고 사전 순서대로 돌려준다.
// 작업 행을 읽어 쓰인 라벨만 고르면 PostgREST max_rows(1000)에서 잘리고, 사용 빈도를 쓰는 화면도 없다.
// 시그니처는 호출부(작업 페이지)와 맞추려고 유지한다
export const getWorkspaceLabels: (workspaceId: string) => Promise<string[]> = async () => Object.keys(TASK_LABEL_LABELS);

// 드로어용 서브태스크·선행 작업. 선행 작업이 삭제됐거나 볼 수 없으면 목록에서 빠진다
export async function selectTaskDetail(
  supabase: Client,
  taskId: string,
): Promise<{ data: TaskDetail; error: null } | { data: null; error: { code?: string; message: string } }> {
  const [subtasks, deps] = await Promise.all([
    supabase.from("subtasks").select("*").eq("task_id", taskId).order("sort_order").order("created_at"),
    supabase
      .from("task_deps")
      .select("blocked:tasks!task_deps_blocked_by_id_fkey(id, key, title, status, deleted_at)")
      .eq("task_id", taskId),
  ]);
  if (subtasks.error) return { data: null, error: subtasks.error };
  if (deps.error) return { data: null, error: deps.error };
  return {
    data: {
      subtasks: subtasks.data,
      blockedBy: deps.data
        .flatMap((d) => (d.blocked && !d.blocked.deleted_at ? [d.blocked] : []))
        .map(({ id, key, title, status }) => ({ id, key, title, status })),
    },
    error: null,
  };
}
