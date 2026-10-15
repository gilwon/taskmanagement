"use server";
// 셸 서버 액션. 사이드바 프로젝트 순서를 사용자·워크스페이스별로 user_prefs.proj_order에 저장한다
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 한 워크스페이스의 프로젝트 수 상한으로 본다. 넘는 입력은 거부한다
const MAX_PROJECTS = 500;

export async function saveProjectOrder(workspaceId: string, ids: string[]): Promise<ActionResult<null>> {
  if (
    typeof workspaceId !== "string" ||
    !UUID_RE.test(workspaceId) ||
    !Array.isArray(ids) ||
    ids.length > MAX_PROJECTS ||
    !ids.every((id) => typeof id === "string" && UUID_RE.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return { ok: false, error: (await getT())("errors.rpc.invalidInput") };
  }
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const sub = claims?.claims?.sub;
    if (!sub) return { ok: false, error: (await getT())("errors.msg.sessionExpired") };
    // 순서 값은 id 목록일 뿐이라 볼 수 없는 프로젝트 id가 섞여도 노출되는 것은 없다. 행은 RLS(user_prefs_owner)가 본인 것만 허용한다.
    // upsert는 넘긴 컬럼만 바꾸므로 같은 행의 최근 검색 등 다른 설정은 그대로다
    const { error } = await supabase
      .from("user_prefs")
      .upsert({ user_id: sub, workspace_id: workspaceId, proj_order: ids }, { onConflict: "user_id,workspace_id" });
    if (error) {
      console.error("[프로젝트 순서]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error) };
    }
    return { ok: true, data: null };
  } catch (e) {
    console.error("[프로젝트 순서]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }) };
  }
}
