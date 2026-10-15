"use server";
// 저장 뷰 생성 Server Action. 세션을 확인하고, 화면이 보낸 지금 필터를 파서로 검증해 saved_views에 넣는다. 권한은 RLS가 판정한다
import { MSG } from "@/lib/auth/errors";
import type { Enums } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";
import { parseViewState } from "@/lib/tasks/view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: readonly Enums<"view_type">[] = ["list", "board", "table"];
const INVALID = "입력값을 다시 확인해 주세요.";

export async function createSavedView(
  workspaceId: string,
  projectId: string,
  name: string,
  type: Enums<"view_type">,
  filters: unknown,
): Promise<ActionResult<{ id: string }>> {
  const title = typeof name === "string" ? name.trim() : "";
  // 이름 길이는 DB check(1~80자)와 같다
  if (
    !UUID_RE.test(String(workspaceId)) ||
    !UUID_RE.test(String(projectId)) ||
    title.length < 1 ||
    title.length > 80 ||
    !TYPES.includes(type)
  ) {
    return { ok: false, error: INVALID };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: MSG.sessionExpired };

  // 클라이언트 값이라 파서로 걸러 낸다(필드·연산자·값 개수). created_by는 트리거가 본인으로 채운다
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      name: title,
      type,
      filters: parseViewState({ filters }).filters,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[저장 뷰 생성]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  return { ok: true, data: { id: data.id } };
}
