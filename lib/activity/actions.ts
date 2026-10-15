"use server";
// 활동 화면 "더 보기" Server Action. 입력을 다시 검증하고 다음 쪽을 읽는다. 범위는 RLS가 자른다
import { MSG } from "@/lib/auth/errors";
import {
  ACTIVITY_KINDS,
  type ActivityCursor,
  type ActivityFilter,
  type ActivityPage,
  isCursor,
  selectActivities,
} from "@/lib/activity/queries";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "입력값을 다시 확인해 주세요.";

export async function loadMoreActivities(
  workspaceId: string,
  projectId: string | null,
  filter: ActivityFilter,
  cursor: ActivityCursor,
): Promise<ActionResult<ActivityPage>> {
  const okFilter =
    filter &&
    typeof filter === "object" &&
    (filter.kind === undefined || (ACTIVITY_KINDS as readonly string[]).includes(filter.kind)) &&
    (filter.actorId === undefined || (typeof filter.actorId === "string" && UUID_RE.test(filter.actorId)));
  if (
    typeof workspaceId !== "string" ||
    !UUID_RE.test(workspaceId) ||
    (projectId !== null && (typeof projectId !== "string" || !UUID_RE.test(projectId))) ||
    !okFilter ||
    !isCursor(cursor)
  ) {
    return { ok: false, error: INVALID };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await selectActivities(
    supabase,
    { workspaceId, projectId: projectId ?? undefined },
    { kind: filter.kind, actorId: filter.actorId },
    { at: cursor.at, id: cursor.id },
  );
  if (error) {
    console.error("[활동 더 보기]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  return { ok: true, data };
}
