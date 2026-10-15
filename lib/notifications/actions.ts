"use server";
// 알림 읽음 처리 Server Action. read_at만 바꿀 수 있고(컬럼 권한) RLS가 본인 알림만 허용한다.
// 성공하면 refresh로 클라이언트 라우터를 새로 그려 탑바·사이드바의 안 읽은 개수를 맞춘다
import { refresh } from "next/cache";
import { MSG } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "입력값을 다시 확인해 주세요.";
const ID_MAX = 200;

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return sub ? { supabase, sub } : null;
}

// read가 false면 읽지 않음으로 되돌린다
export async function markNotifications(ids: string[], read: boolean): Promise<ActionResult<number>> {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > ID_MAX ||
    !ids.every((v) => typeof v === "string" && UUID_RE.test(v)) ||
    typeof read !== "boolean"
  ) {
    return { ok: false, error: INVALID };
  }
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const q = s.supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("user_id", s.sub)
    .in("id", ids);
  const { data, error } = await (read ? q.is("read_at", null) : q.not("read_at", "is", null)).select("id");
  if (error) {
    console.error("[알림 읽음]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  refresh();
  return { ok: true, data: data.length };
}

export async function markAllNotificationsRead(workspaceId: string): Promise<ActionResult<number>> {
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("user_id", s.sub)
    .is("read_at", null)
    .select("id");
  if (error) {
    console.error("[알림 모두 읽음]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  refresh();
  return { ok: true, data: data.length };
}
