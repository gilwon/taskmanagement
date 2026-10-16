// 알림·수신함 서버 조회. RLS가 본인 알림만 보이고, 보낸 사람·작업·프로젝트는 한 번의 임베드 조회로 읽는다
import "server-only";
import type { Enums } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";

export type NotificationItem = {
  id: string;
  type: Enums<"notification_type">;
  // 서버가 고정 템플릿으로 만든 한국어 문구와 평문 발췌. 화면은 update 종류에만 text를 쓴다
  text: string;
  snippet: string | null;
  read: boolean;
  created_at: string;
  actorId: string | null;
  actorName: string | null;
  // 볼 수 없거나 삭제된 작업은 null
  task: { key: string; title: string; deleted: boolean } | null;
  project: { key: string; name: string } | null;
};

// shortcut: 최근 200건까지 읽고 읽지 않음·종류 필터는 화면에서 거른다. 알림이 많아지면 필터를 조회로 옮기고 더 보기를 붙인다
const NOTIFICATION_LIMIT = 200;

export async function getNotifications(workspaceId: string, userId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, type, text, snippet, read_at, created_at, actor_id,
      actor:profiles!notifications_actor_id_fkey(name, email),
      task:tasks!notifications_task_id_project_id_fkey(key, title, deleted_at),
      project:projects!notifications_project_id_workspace_id_fkey(key, name, deleted_at)`,
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIMIT);
  // 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  if (error) {
    console.error("[알림]", error.code, error.message);
    const t = await getT();
    throw new Error(t("notifications.loadFailed", { error: taskErrorMessage(error, t) }));
  }
  return data.map((n) => ({
    id: n.id,
    type: n.type,
    text: n.text,
    snippet: n.snippet,
    read: n.read_at !== null,
    created_at: n.created_at,
    actorId: n.actor_id,
    actorName: n.actor?.name || n.actor?.email || null,
    task: n.task ? { key: n.task.key, title: n.task.title, deleted: n.task.deleted_at !== null } : null,
    project: n.project && !n.project.deleted_at ? { key: n.project.key, name: n.project.name } : null,
  }));
}
