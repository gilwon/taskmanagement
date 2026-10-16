"use server";
// 일정 쓰기 Server Action. 세션 클레임을 확인하고 입력을 검증한 뒤 RLS가 걸린 서버 클라이언트로 일정 날짜를 옮긴다
import { getT } from "@/lib/i18n/server";
import { isIsoDate } from "@/lib/schedule/dates";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server Action은 직접 POST로도 불릴 수 있어 입력을 다시 검증한다
export async function moveEvent(id: string, date: string): Promise<ActionResult<{ id: string; date: string }>> {
  const t = await getT();
  if (typeof id !== "string" || !UUID_RE.test(id) || !isIsoDate(date)) return { ok: false, error: t("errors.rpc.invalidInput") };
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { ok: false, error: t("errors.msg.sessionExpired") };
    const { data, error } = await supabase.from("events").update({ date }).eq("id", id).select("id, date");
    if (error) {
      console.error("[일정 이동]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error, t) };
    }
    // RLS가 권한 없는 행을 건너뛰면 0행이다
    if (data.length === 0) return { ok: false, error: t("schedule.errors.eventNotFound") };
    return { ok: true, data: data[0] };
  } catch (e) {
    console.error("[일정 이동]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t) };
  }
}
