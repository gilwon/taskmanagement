// 활동 화면(워크스페이스·프로젝트) 서버 조회. 종류·사람 필터와 (created_at, id) 커서로 한 쪽씩 읽는다. 범위는 RLS가 자른다
import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { HomeActivity } from "@/lib/home/queries";

type Client = Awaited<ReturnType<typeof createClient>>;

export const ACTIVITY_KINDS = ["status", "comments", "projects"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

// 종류별 verb. 상태 변경은 작업 상태 이동·완료, 프로젝트는 프로젝트 생성·상태 변경
const KIND_VERBS: Record<ActivityKind, string[]> = {
  status: ["moved", "completed"],
  comments: ["commented on"],
  projects: ["created project", "changed status of project"],
};

export type ActivityScope = { workspaceId: string; projectId?: string };
export type ActivityFilter = { kind?: ActivityKind; actorId?: string };
// 같은 트랜잭션의 활동은 created_at이 같으므로 id까지 커서에 넣는다
export type ActivityCursor = { at: string; id: string };
export type ActivityPage = { items: HomeActivity[]; next: ActivityCursor | null };

export const ACTIVITY_PAGE_SIZE = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// PostgREST가 돌려준 timestamptz 문자열 형식. 커서 값은 or 필터 문자열에 들어가므로 이 형식만 받는다
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function isCursor(c: unknown): c is ActivityCursor {
  if (!c || typeof c !== "object") return false;
  const { at, id } = c as Record<string, unknown>;
  return typeof at === "string" && TS_RE.test(at) && typeof id === "string" && UUID_RE.test(id);
}

// 삭제된 프로젝트의 활동은 뺀다. 오류는 호출부가 문구로 바꾼다
export async function selectActivities(
  supabase: Client,
  scope: ActivityScope,
  filter: ActivityFilter,
  cursor: ActivityCursor | null,
): Promise<{ data: ActivityPage; error: null } | { data: null; error: { code?: string; message: string } }> {
  let q = supabase
    .from("activities")
    .select(
      `id, verb, extra, created_at, task_id, actor_id,
      actor:profiles!activities_actor_id_fkey(name, email),
      task:tasks!activities_task_id_project_id_fkey(key, title),
      project:projects!activities_project_id_workspace_id_fkey!inner(key, name, deleted_at)`,
    )
    .eq("workspace_id", scope.workspaceId)
    .is("project.deleted_at", null);
  if (scope.projectId) q = q.eq("project_id", scope.projectId);
  if (filter.kind) q = q.in("verb", KIND_VERBS[filter.kind]);
  if (filter.actorId) q = q.eq("actor_id", filter.actorId);
  // 값의 . : +는 PostgREST 예약 문자라 큰따옴표로 감싼다
  if (cursor) q = q.or(`created_at.lt."${cursor.at}",and(created_at.eq."${cursor.at}",id.lt.${cursor.id})`);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE + 1);
  if (error) return { data: null, error };
  const rows = data.slice(0, ACTIVITY_PAGE_SIZE);
  const last = rows[rows.length - 1];
  return {
    data: {
      items: rows.map((a) => ({
        id: a.id,
        verb: a.verb,
        extra: a.extra,
        created_at: a.created_at,
        actorId: a.actor_id,
        actorName: a.actor?.name || a.actor?.email || null,
        hasTask: a.task_id !== null,
        task: a.task ? { key: a.task.key, title: a.task.title } : null,
        project: { key: a.project.key, name: a.project.name },
      })),
      next: data.length > ACTIVITY_PAGE_SIZE && last ? { at: last.created_at, id: last.id } : null,
    },
    error: null,
  };
}
