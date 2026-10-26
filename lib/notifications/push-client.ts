// 브라우저 쪽 웹 푸시 구독·해제. 권한 요청, 서비스워커 등록, pushManager 구독 후 서버 액션으로 저장한다
import { removePushSubscription, savePushSubscription } from "@/lib/notifications/push-actions";

export type EnablePushResult = { status: "ok" } | { status: "denied" } | { status: "unsupported" } | { status: "failed"; error?: string };

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// 공개 VAPID 키(URL-safe base64)를 pushManager가 받는 바이트로 바꾼다
function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(vapidPublicKey: string): Promise<EnablePushResult> {
  if (!pushSupported()) return { status: "unsupported" };
  if ((await Notification.requestPermission()) !== "granted") return { status: "denied" };
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) });
    const r = await savePushSubscription(sub.toJSON());
    if (!r.ok) {
      await sub.unsubscribe();
      return { status: "failed", error: r.error };
    }
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}

// 이 브라우저의 구독을 서버에서 지우고 브라우저에서도 해제한다
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}
