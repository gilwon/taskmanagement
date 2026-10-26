// 이메일·푸시 발송의 순수 로직. 발송 대상 판정, 시도 횟수 처리, 링크·메일 본문 생성, 인증 비교, 푸시 구독 검증
import { createHash, timingSafeEqual } from "node:crypto";
import { DEFAULT_LOCALE, isSelectableLocale, type Locale } from "@/lib/i18n/locales";
import en from "@/lib/i18n/messages/en";
import ja from "@/lib/i18n/messages/ja";
import ko from "@/lib/i18n/messages/ko";
import zhCN from "@/lib/i18n/messages/zh-CN";

// 한 번에 처리하는 알림 수와 실패 허용 횟수. 한도에 닿으면 시각을 채워 더는 재시도하지 않는다
export const DISPATCH_BATCH = 100;
export const MAX_DISPATCH_ATTEMPTS = 5;

export type Channel = "email" | "push";
// done 이미 보냄, skip 보낼 필요 없음(채널 꺼짐·주소 없음·구독 없음)이라 시각만 채움, send 보낸다
export type ChannelPlan = "done" | "skip" | "send";

export function planChannel(sentAt: string | null, enabled: boolean): ChannelPlan {
  if (sentAt) return "done";
  return enabled ? "send" : "skip";
}

export type DispatchPatch = { emailed_at?: string; pushed_at?: string; dispatch_attempts?: number };

// 발송 결과를 DB 갱신 값으로 바꾼다. 보냈거나 skip이면 시각을 채우고, 실패한 채널이 있으면 횟수를 올린다.
// 횟수가 한도에 닿으면 실패한 채널도 시각을 채워 재시도를 끝낸다
export function settle(
  plan: Record<Channel, ChannelPlan>,
  ok: Record<Channel, boolean>,
  attempts: number,
  now: string,
): DispatchPatch {
  const failed = (["email", "push"] as const).filter((c) => plan[c] === "send" && !ok[c]);
  const nextAttempts = failed.length ? attempts + 1 : attempts;
  const giveUp = nextAttempts >= MAX_DISPATCH_ATTEMPTS;
  const patch: DispatchPatch = {};
  if (plan.email !== "done" && (!failed.includes("email") || giveUp)) patch.emailed_at = now;
  if (plan.push !== "done" && (!failed.includes("push") || giveUp)) patch.pushed_at = now;
  if (nextAttempts !== attempts) patch.dispatch_attempts = nextAttempts;
  return patch;
}

// 알림이 가리키는 앱 경로. components/notifications/notification-parts.tsx의 notificationHref와 같은 규칙이다
export function notificationPath(
  ws: string,
  n: { type: string; taskKey?: string | null; taskDeleted?: boolean; projectKey?: string | null; stockItemId?: string | null },
) {
  if (n.taskKey && !n.taskDeleted) return `/${ws}/task/${n.taskKey}`;
  if (!n.taskKey && n.projectKey) return `/${ws}/projects/${n.projectKey}/overview`;
  if (n.type === "stock" && n.stockItemId) return `/${ws}/inventory?item=${n.stockItemId}`;
  return `/${ws}/inbox`;
}

const TYPE_LABELS = { ko, en, ja, "zh-CN": zhCN } as const;

export function pickLocale(v: unknown): Locale {
  return isSelectableLocale(v) ? v : DEFAULT_LOCALE;
}

// 메일 제목·본문과 푸시 제목·본문. 본문은 알림 한 줄과 링크다. text는 DB에 고정된 문구라 로캘과 무관하다
export function buildMessage(
  locale: Locale,
  n: { type: keyof typeof ko.common.notificationType; text: string },
  path: string,
  siteUrl: string | undefined,
) {
  const title = TYPE_LABELS[locale].common.notificationType[n.type] ?? n.type;
  const url = siteUrl ? `${siteUrl.replace(/\/+$/, "")}${path}` : null;
  return { title, body: n.text, url, subject: `[${title}] ${n.text}`, mailText: url ? `${n.text}\n\n${url}\n` : `${n.text}\n` };
}

// Authorization: Bearer <secret> 상수 시간 비교. 길이가 달라도 해시 길이가 같아 timingSafeEqual이 던지지 않는다
export function isAuthorized(header: string | null, secret: string) {
  if (!header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };

// 브라우저 PushSubscription.toJSON() 결과를 검증한다. https 주소와 두 키 문자열만 통과한다
export function parsePushSubscription(v: unknown): PushSub | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  const { endpoint } = o;
  const p256dh = o.keys?.p256dh;
  const auth = o.keys?.auth;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !/^https:\/\//.test(endpoint)) return null;
  if (typeof p256dh !== "string" || !p256dh || p256dh.length > 256) return null;
  if (typeof auth !== "string" || !auth || auth.length > 256) return null;
  return { endpoint, p256dh, auth };
}
