"use server";
// 커맨드 팔레트가 쓰는 조회. 최근에 바뀐 작업, 기한 지난 작업 몇 개를 돌려준다. 범위는 RLS가 자른다
import type { Enums } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { todayIso } from "@/lib/schedule/dates";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_TASKS = 5;
const OVERDUE_TASKS = 20;

export type PaletteTask = { key: string; title: string; status: Enums<"task_status"> };

export async function loadRecentTasks(workspaceId: string): Promise<ActionResult<PaletteTask[]>> {
  return loadTasks(workspaceId, "recent");
}

// 완료되지 않았고 기한이 서울 기준 오늘보다 앞선 작업. 기한이 오래된 순
export async function loadOverdueTasks(workspaceId: string): Promise<ActionResult<PaletteTask[]>> {
  return loadTasks(workspaceId, "overdue");
}

async function loadTasks(workspaceId: string, kind: "recent" | "overdue"): Promise<ActionResult<PaletteTask[]>> {
  const t = await getT();
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { ok: false, error: t("errors.msg.sessionExpired") };
    // 작업 목록 조회와 같은 기준. 삭제·보관된 작업과 삭제·보관된 프로젝트의 작업은 뺀다
    const base = supabase
      .from("tasks")
      .select("key, title, status, project:projects!tasks_project_id_workspace_id_fkey!inner(id)")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("project.deleted_at", null)
      .is("project.archived_at", null);
    const { data, error } =
      kind === "recent"
        ? await base.order("updated_at", { ascending: false }).limit(RECENT_TASKS)
        : await base
            .neq("status", "done")
            .lt("due_date", todayIso(new Date()))
            .order("due_date", { ascending: true })
            .limit(OVERDUE_TASKS);
    if (error) {
      console.error("[팔레트 작업]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error, t) };
    }
    return { ok: true, data: data.map(({ key, title, status }) => ({ key, title, status })) };
  } catch (e) {
    console.error("[팔레트 작업]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t) };
  }
}
