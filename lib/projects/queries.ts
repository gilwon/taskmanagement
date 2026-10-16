// 프로젝트 목록·개요·즐겨찾기·보관함 서버 조회. 범위는 RLS가 자르고, 집계는 한 번의 임베드 조회에서 순수 함수로 만든다
import "server-only";
import type { Enums } from "@/lib/database.types";
import { lastActive, taskStats } from "@/lib/projects/stats";
import type { Milestone, ProjectMemberRow, ProjectSummary, SharePerm, TaskLite } from "@/lib/projects/types";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages/types";
import type { T } from "@/lib/i18n/t";
import { projectErrorMessage } from "@/lib/projects/errors";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/lib/tasks/types";

type Client = Awaited<ReturnType<typeof createClient>>;

type LoadWhat = keyof Messages["projects"]["load"];

// 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22). what은 사전 projects.load의 키이고 로그 태그로도 쓴다
function fail(t: T, what: LoadWhat, error: { code?: string; message: string }): never {
  console.error(`[${what}]`, error.code, error.message);
  throw new Error(t("projects.errors.loadFailed", { what: t(`projects.load.${what}`), reason: projectErrorMessage(error, t) }));
}

// 프로젝트별 현재 사용자 권한. 실패하면 오류로 올린다
// shortcut: 프로젝트마다 권한 RPC를 한 번씩 부른다(새 작업 선택지와 같은 방식). 프로젝트가 수십 개를 넘으면 한 번에 묻는 RPC로 바꾼다
export async function projectPerms(supabase: Client, ids: readonly string[]): Promise<Map<string, SharePerm | null>> {
  const t = await getT();
  const unique = [...new Set(ids)];
  const rows = await Promise.all(unique.map((p) => supabase.rpc("project_perm", { p })));
  const failed = rows.find((r) => r.error);
  if (failed?.error) fail(t, "perms", failed.error);
  return new Map(unique.map((id, i) => [id, (rows[i].data as SharePerm | null) ?? null]));
}

// 삭제되지 않은 프로젝트 전부(보관 포함)와 그 작업 요약. 작업은 삭제·보관된 것을 뺀다
export async function getProjectSummaries(workspaceId: string, userId: string): Promise<ProjectSummary[]> {
  const t = await getT();
  const supabase = await createClient();
  const [projects, favorites] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `id, key, name, icon, color, status, access, lead_id, due_date, archived_at, updated_at,
        project_members(user_id),
        tasks!tasks_project_id_workspace_id_fkey(status, assignee_id, due_date, updated_at)`,
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("tasks.deleted_at", null)
      .is("tasks.archived_at", null)
      .order("name"),
    supabase
      .from("favorites")
      .select("project_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .not("project_id", "is", null),
  ]);
  if (projects.error) fail(t, "projects", projects.error);
  if (favorites.error) fail(t, "favorites", favorites.error);

  const perms = await projectPerms(supabase, projects.data.map((p) => p.id));
  const favIds = new Set(favorites.data.map((f) => f.project_id));
  const now = new Date();
  return projects.data.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    icon: p.icon,
    color: p.color,
    status: p.status,
    access: p.access,
    leadId: p.lead_id,
    dueDate: p.due_date,
    archivedAt: p.archived_at,
    lastActiveAt: lastActive(p.updated_at, p.tasks),
    memberIds: p.project_members.map((m) => m.user_id),
    favorite: favIds.has(p.id),
    perm: perms.get(p.id) ?? null,
    stats: taskStats(p.tasks, now),
    tasks: p.tasks,
  }));
}

export type ProjectDetail = {
  id: string;
  key: string;
  name: string;
  status: Enums<"project_status">;
  access: Enums<"project_access">;
  leadId: string | null;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
  archivedAt: string | null;
  perm: SharePerm | null;
  members: ProjectMemberRow[];
  milestones: Milestone[];
  // 다가오는 작업 목록용(열린 작업, 기한 이른 순)
  upcoming: { id: string; key: string; title: string; status: TaskStatus; due_date: string | null; assignee_id: string | null }[];
  tasks: TaskLite[];
};

const UPCOMING_MAX = 5;

// 프로젝트 개요 탭. 상세 값·권한·구성원 권한·마일스톤·작업 요약
export async function getProjectDetail(projectId: string): Promise<ProjectDetail> {
  const t = await getT();
  const supabase = await createClient();
  const [project, members, milestones, tasks, perms] = await Promise.all([
    supabase
      .from("projects")
      .select("id, key, name, status, access, lead_id, start_date, due_date, description, archived_at")
      .eq("id", projectId)
      .single(),
    supabase.from("project_members").select("user_id, perm").eq("project_id", projectId),
    supabase.from("milestones").select("id, name, date").eq("project_id", projectId).order("date"),
    supabase
      .from("tasks")
      .select("id, key, title, status, assignee_id, due_date, updated_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .is("archived_at", null),
    projectPerms(supabase, [projectId]),
  ]);
  if (project.error) fail(t, "project", project.error);
  if (members.error) fail(t, "members", members.error);
  if (milestones.error) fail(t, "milestones", milestones.error);
  if (tasks.error) fail(t, "tasks", tasks.error);

  const p = project.data;
  const upcoming = tasks.data
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      if (a.due_date === b.due_date) return a.key.localeCompare(b.key, "en", { numeric: true });
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    })
    .slice(0, UPCOMING_MAX);
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    status: p.status,
    access: p.access,
    leadId: p.lead_id,
    startDate: p.start_date,
    dueDate: p.due_date,
    description: p.description,
    archivedAt: p.archived_at,
    perm: perms.get(projectId) ?? null,
    members: members.data.map((m) => ({ userId: m.user_id, perm: m.perm })),
    milestones: milestones.data,
    upcoming,
    tasks: tasks.data,
  };
}

// ─────────────────────────────────────────────
// 즐겨찾기
// ─────────────────────────────────────────────

export type FavoriteProject = {
  favoriteId: string;
  createdAt: string;
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  status: Enums<"project_status">;
  archived: boolean;
};

export type FavoriteTask = {
  favoriteId: string;
  createdAt: string;
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  priority: Enums<"task_priority">;
  dueDate: string | null;
  assigneeId: string | null;
  archived: boolean;
  project: { key: string; name: string; color: string };
};

// 본인 즐겨찾기. 대상이 소프트 삭제된 행은 남아 있어도 뺀다(복원되면 다시 보인다)
export async function getFavorites(workspaceId: string, userId: string) {
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `id, created_at, project_id, task_id,
      project:projects!favorites_project_workspace_fkey(id, key, name, icon, color, status, archived_at, deleted_at),
      task:tasks!favorites_task_workspace_fkey(id, key, title, status, priority, due_date, assignee_id, archived_at, deleted_at,
        project:projects!tasks_project_id_workspace_id_fkey(key, name, color, archived_at, deleted_at))`,
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) fail(t, "favorites", error);

  const projects: FavoriteProject[] = [];
  const tasks: FavoriteTask[] = [];
  for (const f of data) {
    const p = f.project;
    if (p && !p.deleted_at) {
      projects.push({
        favoriteId: f.id,
        createdAt: f.created_at,
        id: p.id,
        key: p.key,
        name: p.name,
        icon: p.icon,
        color: p.color,
        status: p.status,
        archived: p.archived_at !== null,
      });
    }
    const t = f.task;
    if (t && !t.deleted_at && !t.project.deleted_at) {
      tasks.push({
        favoriteId: f.id,
        createdAt: f.created_at,
        id: t.id,
        key: t.key,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        assigneeId: t.assignee_id,
        archived: t.archived_at !== null || t.project.archived_at !== null,
        project: { key: t.project.key, name: t.project.name, color: t.project.color },
      });
    }
  }
  return { projects, tasks };
}

// ─────────────────────────────────────────────
// 보관함(휴지통 + 보관)
// ─────────────────────────────────────────────

type TrashProjectRef = { id: string; key: string; name: string; color: string };

export type TrashProject = TrashProjectRef & {
  icon: string;
  deletedAt: string | null;
  archivedAt: string | null;
  // 복원 토큰. 받은 updated_at 문자열을 그대로 넘긴다(Date로 바꾸지 않는다)
  token: string;
};

export type TrashTask = {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  deletedAt: string | null;
  archivedAt: string | null;
  token: string;
  project: TrashProjectRef;
};

export type TrashComment = {
  id: string;
  body: string;
  authorId: string | null;
  deletedAt: string;
  deletedBy: string | null;
  token: string;
  task: { key: string; title: string };
  project: TrashProjectRef;
};

export type TrashFile = {
  id: string;
  name: string;
  type: Enums<"file_type">;
  sizeBytes: number;
  uploadedBy: string | null;
  deletedAt: string;
  token: string;
  project: TrashProjectRef;
};

export type TrashData = {
  projects: TrashProject[];
  tasks: TrashTask[];
  comments: TrashComment[];
  files: TrashFile[];
  // 항목이 속한 프로젝트별 현재 사용자 권한. 영구 삭제 버튼은 full일 때만 보인다
  perms: Record<string, SharePerm | null>;
};

// shortcut: 종류마다 최근 200건까지만 읽는다. 보관함이 그보다 커지면 페이지 조회로 바꾼다
const TRASH_LIMIT = 200;

// 삭제된 항목은 상위가 살아 있는 것만 보인다. 삭제된 프로젝트의 하위 항목은 purge_*·restore_*가
// project_deleted로 거부하고 프로젝트와 함께 복원되므로 프로젝트 한 줄로만 보인다.
// 소프트 삭제 행은 편집 권한자(댓글은 작성자 본인 포함)에게만 보인다(RLS)
export async function getTrash(workspaceId: string): Promise<TrashData> {
  const t = await getT();
  const supabase = await createClient();
  const [projects, tasks, comments, files] = await Promise.all([
    supabase
      .from("projects")
      .select("id, key, name, icon, color, deleted_at, archived_at, updated_at")
      .eq("workspace_id", workspaceId)
      .or("deleted_at.not.is.null,archived_at.not.is.null")
      .order("updated_at", { ascending: false })
      .limit(TRASH_LIMIT),
    supabase
      .from("tasks")
      .select(
        `id, key, title, status, deleted_at, archived_at, updated_at,
        project:projects!tasks_project_id_workspace_id_fkey!inner(id, key, name, color, deleted_at)`,
      )
      .eq("workspace_id", workspaceId)
      .or("deleted_at.not.is.null,archived_at.not.is.null")
      .is("project.deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(TRASH_LIMIT),
    supabase
      .from("comments")
      .select(
        `id, body, author_id, deleted_at, deleted_by, updated_at,
        task:tasks!inner(key, title, workspace_id, deleted_at,
          project:projects!tasks_project_id_workspace_id_fkey!inner(id, key, name, color, deleted_at))`,
      )
      .not("deleted_at", "is", null)
      .eq("task.workspace_id", workspaceId)
      .is("task.deleted_at", null)
      .is("task.project.deleted_at", null)
      .order("deleted_at", { ascending: false })
      .limit(TRASH_LIMIT),
    supabase
      .from("files")
      .select(
        `id, name, type, size_bytes, uploaded_by, deleted_at, updated_at,
        project:projects!files_project_id_workspace_id_fkey!inner(id, key, name, color, deleted_at)`,
      )
      .eq("workspace_id", workspaceId)
      .not("deleted_at", "is", null)
      .is("project.deleted_at", null)
      .order("deleted_at", { ascending: false })
      .limit(TRASH_LIMIT),
  ]);
  if (projects.error) fail(t, "archivedProjects", projects.error);
  if (tasks.error) fail(t, "archivedTasks", tasks.error);
  if (comments.error) fail(t, "deletedComments", comments.error);
  if (files.error) fail(t, "deletedFiles", files.error);

  const ref = (p: TrashProjectRef) => ({ id: p.id, key: p.key, name: p.name, color: p.color });
  const data: Omit<TrashData, "perms"> = {
    projects: projects.data.map((p) => ({
      ...ref(p),
      icon: p.icon,
      deletedAt: p.deleted_at,
      archivedAt: p.archived_at,
      token: p.updated_at,
    })),
    tasks: tasks.data.map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      status: t.status,
      deletedAt: t.deleted_at,
      archivedAt: t.archived_at,
      token: t.updated_at,
      project: ref(t.project),
    })),
    comments: comments.data.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.author_id,
      // not("deleted_at", "is", null)로 거른 행이다
      deletedAt: c.deleted_at!,
      deletedBy: c.deleted_by,
      token: c.updated_at,
      task: { key: c.task.key, title: c.task.title },
      project: ref(c.task.project),
    })),
    files: files.data.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      sizeBytes: f.size_bytes,
      uploadedBy: f.uploaded_by,
      deletedAt: f.deleted_at!,
      token: f.updated_at,
      project: ref(f.project),
    })),
  };
  const ids = [
    ...data.projects.map((p) => p.id),
    ...data.tasks.map((t) => t.project.id),
    ...data.comments.map((c) => c.project.id),
    ...data.files.map((f) => f.project.id),
  ];
  const perms = await projectPerms(supabase, ids);
  return { ...data, perms: Object.fromEntries(perms) };
}
