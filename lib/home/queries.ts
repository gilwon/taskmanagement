// 홈 화면용 서버 조회. 프로젝트 진행 표와 최근 활동을 각각 한 번의 임베드 조회로 읽고, 범위는 RLS가 자른다
import "server-only";
import type { Enums } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";

// 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
function fail(t: T, what: "projects" | "activity", error: { code?: string; message: string }): never {
  console.error(`[${what}]`, error.code, error.message);
  throw new Error(t("home.errors.loadFailed", { what: t(`home.load.${what}`), reason: taskErrorMessage(error, t) }));
}

export type HomeProject = {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  status: Enums<"project_status">;
  due_date: string | null;
  // project_members의 사용자 id
  memberIds: string[];
};

// 삭제·보관된 프로젝트는 뺀다. 비공개 프로젝트는 RLS가 구성원에게만 보인다
export async function getHomeProjects(workspaceId: string): Promise<HomeProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, key, name, icon, color, status, due_date, project_members(user_id)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("name");
  if (error) fail(await getT(), "projects", error);
  return data.map(({ project_members, ...p }) => ({ ...p, memberIds: project_members.map((m) => m.user_id) }));
}

export type HomeActivity = {
  id: string;
  verb: string;
  extra: unknown;
  created_at: string;
  actorId: string | null;
  actorName: string | null;
  // task_id가 있던 활동인지. 작업이 영구 삭제되면 task_id가 비고, 볼 수 없으면 task가 null이다
  hasTask: boolean;
  task: { key: string; title: string } | null;
  project: { key: string; name: string };
};

// 최근 활동 limit건. 삭제된 프로젝트의 활동은 뺀다
export async function getRecentActivities(workspaceId: string, limit: number): Promise<HomeActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, verb, extra, created_at, task_id, actor_id,
      actor:profiles!activities_actor_id_fkey(name, email),
      task:tasks!activities_task_id_project_id_fkey(key, title),
      project:projects!activities_project_id_workspace_id_fkey!inner(key, name, deleted_at)`,
    )
    .eq("workspace_id", workspaceId)
    .is("project.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(await getT(), "activity", error);
  return data.map((a) => ({
    id: a.id,
    verb: a.verb,
    extra: a.extra,
    created_at: a.created_at,
    actorId: a.actor_id,
    actorName: a.actor?.name || a.actor?.email || null,
    hasTask: a.task_id !== null,
    task: a.task ? { key: a.task.key, title: a.task.title } : null,
    project: { key: a.project.key, name: a.project.name },
  }));
}
