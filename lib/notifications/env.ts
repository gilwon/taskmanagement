// 이메일·푸시 발송에 필요한 서버 환경변수가 갖춰졌는지 본다. 값은 내보내지 않고 가능 여부만 돌려준다
import "server-only";

export function getChannelConfig() {
  const e = process.env;
  // 크론 인증과 service role 키가 없으면 dispatch가 돌 수 없어 두 채널 모두 쓸 수 없다
  const runnable = Boolean(e.SUPABASE_SERVICE_ROLE_KEY && e.CRON_SECRET);
  return {
    email: runnable && Boolean(e.SMTP_URL && e.MAIL_FROM),
    push: runnable && Boolean(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT),
  };
}
