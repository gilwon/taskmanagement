// 아직 보내지 않은 알림을 수신자의 채널 설정대로 이메일·웹 푸시로 보낸다. service role을 쓰므로 dispatch 라우트에서만 호출한다
import "server-only";
import nodemailer from "nodemailer";
import webpush from "web-push";
import {
  DISPATCH_BATCH,
  buildMessage,
  notificationPath,
  pickLocale,
  planChannel,
  settle,
  type ChannelPlan,
} from "@/lib/notifications/delivery";
import { getChannelConfig } from "@/lib/notifications/env";
import { readNotifPrefs } from "@/lib/org/rules";
import { createAdminClient } from "@/lib/supabase/admin";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

const group = <T extends { user_id: string }>(rows: T[]) => {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
  return m;
};

export async function runDispatch() {
  const cfg = getChannelConfig();
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("notifications")
    .select(
      `id, user_id, workspace_id, type, text, stock_item_id, emailed_at, pushed_at, dispatch_attempts,
       task:tasks!notifications_task_id_project_id_fkey(key, deleted_at),
       project:projects!notifications_project_id_workspace_id_fkey(key),
       workspace:workspaces!notifications_workspace_id_fkey(slug)`,
    )
    .or("emailed_at.is.null,pushed_at.is.null")
    .order("created_at")
    .limit(DISPATCH_BATCH);
  if (error) throw new Error(error.message);
  const summary = { processed: rows.length, emailed: 0, pushed: 0, failed: 0 };
  if (rows.length === 0) return summary;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [prefsRes, profilesRes, subsRes] = await Promise.all([
    admin.from("user_prefs").select("user_id, workspace_id, notif_prefs").in("user_id", userIds),
    admin.from("profiles").select("id, locale").in("id", userIds),
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds),
  ]);
  for (const r of [prefsRes, profilesRes, subsRes]) if (r.error) throw new Error(r.error.message);
  const prefsOf = new Map((prefsRes.data ?? []).map((p) => [`${p.user_id}:${p.workspace_id}`, p.notif_prefs]));
  const localeOf = new Map((profilesRes.data ?? []).map((p) => [p.id, p.locale]));
  const subsOf = group(subsRes.data ?? []);

  const transport = cfg.email ? nodemailer.createTransport(process.env.SMTP_URL!) : null;
  if (cfg.push) webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

  // 수신자 이메일은 auth.users에서 admin API로만 읽는다. 사용자마다 한 번만 묻는다
  const addresses = new Map<string, Promise<string | null>>();
  const addressOf = (id: string) => {
    if (!addresses.has(id)) addresses.set(id, admin.auth.admin.getUserById(id).then((r) => r.data.user?.email ?? null, () => null));
    return addresses.get(id)!;
  };

  // 404·410은 만료된 구독이라 지운다. 하나라도 보냈거나 일시 오류가 없으면 성공이다
  const sendPush = async (subs: Sub[], payload: string) => {
    const gone: string[] = [];
    let sent = 0;
    let transient = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.id);
          else transient++;
        }
      }),
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    return sent > 0 || transient === 0;
  };

  for (const r of rows) {
    const prefs = readNotifPrefs(prefsOf.get(`${r.user_id}:${r.workspace_id}`));
    const subs = subsOf.get(r.user_id) ?? [];
    const to = !r.emailed_at && prefs.email && transport ? await addressOf(r.user_id) : null;
    const plan: { email: ChannelPlan; push: ChannelPlan } = {
      email: planChannel(r.emailed_at, Boolean(to)),
      push: planChannel(r.pushed_at, prefs.push && cfg.push && subs.length > 0),
    };
    const ok = { email: true, push: true };
    const path = notificationPath(r.workspace?.slug ?? "", {
      type: r.type,
      taskKey: r.task?.key,
      taskDeleted: r.task?.deleted_at != null,
      projectKey: r.project?.key,
      stockItemId: r.stock_item_id,
    });
    const msg = buildMessage(pickLocale(localeOf.get(r.user_id)), r, path, process.env.SITE_URL);

    if (plan.email === "send" && transport && to) {
      try {
        await transport.sendMail({ from: process.env.MAIL_FROM, to, subject: msg.subject, text: msg.mailText });
        summary.emailed++;
      } catch (e) {
        ok.email = false;
        console.error("[dispatch] mail", e instanceof Error ? e.message : "unknown");
      }
    }
    if (plan.push === "send") {
      ok.push = await sendPush(subs, JSON.stringify({ title: msg.title, body: msg.body, url: path }));
      if (ok.push) summary.pushed++;
    }
    if (!ok.email || !ok.push) summary.failed++;

    const patch = settle(plan, ok, r.dispatch_attempts, new Date().toISOString());
    if (Object.keys(patch).length) {
      const { error: upErr } = await admin.from("notifications").update(patch).eq("id", r.id);
      if (upErr) console.error("[dispatch] update", upErr.message);
    }
  }
  return summary;
}
