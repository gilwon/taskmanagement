"use server";
// 새 작업 모달이 열릴 때 쓰는 선택지 조회. 편집 권한이 있는 프로젝트와 담당자 후보 구성원을 돌려준다
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { getWorkspaceMembers } from "@/lib/tasks/queries";
import type { ActionResult, WorkspaceMember } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProjectOption = { id: string; key: string; name: string; color: string; icon: string };
export type NewTaskOptions = { projects: ProjectOption[]; members: WorkspaceMember[] };

export async function loadNewTaskOptions(workspaceId: string): Promise<ActionResult<NewTaskOptions>> {
  const t = await getT();
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { ok: false, error: t("errors.msg.sessionExpired") };

    const { data, error } = await supabase
      .from("projects")
      .select("id, key, name, color, icon")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("name");
    if (error) {
      console.error("[새 작업 프로젝트]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error, t) };
    }
    // shortcut: 프로젝트마다 권한 RPC를 한 번씩 부른다. 프로젝트가 수십 개를 넘으면 한 번에 묻는 RPC로 바꾼다
    const perms = await Promise.all(data.map((p) => supabase.rpc("can_edit_project", { p: p.id })));
    const failed = perms.find((r) => r.error);
    if (failed?.error) {
      console.error("[새 작업 권한]", failed.error.code, failed.error.message);
      return { ok: false, error: taskErrorMessage(failed.error, t) };
    }
    const projects = data.filter((_, i) => perms[i].data === true);
    const members = await getWorkspaceMembers(workspaceId);
    return { ok: true, data: { projects, members } };
  } catch (e) {
    console.error("[새 작업 선택지]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t) };
  }
}
