"use server";
// 웹 푸시 구독 저장·삭제 Server Action. RLS가 본인 행만 허용한다
import { getT } from "@/lib/i18n/server";
import { parsePushSubscription } from "@/lib/notifications/delivery";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/tasks/types";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return sub ? { supabase, uid: sub } : null;
}

// 같은 브라우저를 다시 구독하면 endpoint가 같으므로 내 옛 행을 먼저 지우고 넣는다
export async function savePushSubscription(subscription: unknown): Promise<ActionResult<null>> {
  const t = await getT();
  const sub = parsePushSubscription(subscription);
  if (!sub) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  await s.supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await s.supabase
    .from("push_subscriptions")
    .insert({ user_id: s.uid, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth });
  if (error) {
    console.error("[푸시 구독]", error.message);
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  return { ok: true, data: null };
}

export async function removePushSubscription(endpoint: unknown): Promise<ActionResult<null>> {
  const t = await getT();
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const { error } = await s.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error("[푸시 구독 삭제]", error.message);
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  return { ok: true, data: null };
}
