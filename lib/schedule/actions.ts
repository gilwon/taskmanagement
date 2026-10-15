"use server";
// 일정 쓰기 Server Action. 세션 클레임을 확인하고 입력을 검증한 뒤 RLS가 걸린 서버 클라이언트로 일정 날짜를 옮긴다
import { MSG } from "@/lib/auth/errors";
import { isIsoDate } from "@/lib/schedule/dates";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "입력값을 다시 확인해 주세요.";
const EVENT_NOT_FOUND = "일정을 찾을 수 없습니다. 삭제되었거나 바꿀 권한이 없습니다.";

// Server Action은 직접 POST로도 불릴 수 있어 입력을 다시 검증한다
export async function moveEvent(id: string, date: string): Promise<ActionResult<{ id: string; date: string }>> {
  if (typeof id !== "string" || !UUID_RE.test(id) || !isIsoDate(date)) return { ok: false, error: INVALID };
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { ok: false, error: MSG.sessionExpired };
    const { data, error } = await supabase.from("events").update({ date }).eq("id", id).select("id, date");
    if (error) {
      console.error("[일정 이동]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error) };
    }
    // RLS가 권한 없는 행을 건너뛰면 0행이다
    if (data.length === 0) return { ok: false, error: EVENT_NOT_FOUND };
    return { ok: true, data: data[0] };
  } catch (e) {
    console.error("[일정 이동]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }) };
  }
}
