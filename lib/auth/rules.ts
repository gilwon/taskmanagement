// 인증·온보딩 입력 규칙과 선택지. 클라이언트 폼과 Server Action이 같은 규칙을 쓴다
import { TEMPLATE_LABELS } from "@/lib/i18n/labels";

// supabase/config.toml의 auth.minimum_password_length와 같아야 한다
export const MIN_PASSWORD_LENGTH = 8;

// 마이그레이션 workspaces.slug check와 create_workspace_onboarding의 정규식과 같다
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;

// create_workspace_onboarding의 초대 이메일 검사와 같다
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 재설정 링크로 만든 세션만 비밀번호를 바꿀 수 있는 시간(초)
export const RECOVERY_WINDOW_SEC = 10 * 60;

// 재설정 링크 세션인지 판단한다. 로컬 GoTrue에서 PKCE code 교환 뒤 amr은 [{ method: "recovery", timestamp }]이고
// 토큰을 갱신해도 그대로 남으므로 timestamp로 유효 시간을 제한한다. 일반 로그인은 method가 "password"다.
// 메일의 token_hash 링크(verifyOtp)로 만든 세션은 amr이 "otp"라 가입 확인 세션과 구별되지 않는다.
// 그래서 "otp"는 Auth 서버 값인 user.recovery_sent_at(재설정 메일을 보낸 시각)도 유효 시간 안일 때만 인정한다
export function isRecoverySession(
  claims: { amr?: ({ method: string; timestamp: number } | string)[] } | null | undefined,
  recoverySentAt: string | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
) {
  const within = (sec: number) => nowSec - sec >= 0 && nowSec - sec <= RECOVERY_WINDOW_SEC;
  const sentSec = recoverySentAt ? Math.floor(Date.parse(recoverySentAt) / 1000) : NaN;
  return (claims?.amr ?? []).some(
    (entry) =>
      typeof entry === "object" &&
      within(entry.timestamp) &&
      (entry.method === "recovery" || (entry.method === "otp" && within(sentSec))),
  );
}

// JWT 서명은 유효하지만 Auth 서버에 사용자(지워진 계정)나 세션(끊긴 세션)이 없다는 getUser 오류 코드
export function isGoneSession(code: string | undefined) {
  return code === "user_not_found" || code === "session_not_found";
}

// 워크스페이스 이름에서 URL 후보를 만든다. 영문·숫자 외 문자는 지우고 형식에 맞지 않으면 빈 값이다
export function suggestSlug(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 39)
    .replace(/-+$/, "");
  return SLUG_RE.test(slug) ? slug : "";
}

// 표시명은 사전(org.onboarding.usage.<id>)에 있다
export const USAGES = [{ id: "work" }, { id: "personal" }, { id: "school" }, { id: "other" }] as const;

// 저장값은 workspaces.team_size check 값이다. 표시명은 사전(org.onboarding.teamSize.<id>)에 있다
export const TEAM_SIZES = [{ id: "solo" }, { id: "2-10" }, { id: "11-50" }, { id: "51-200" }, { id: "200+" }] as const;

// 저장값은 create_project의 템플릿 검사 값이다. 표시명은 단일 사전(TEMPLATE_LABELS)에서 가져온다
export const TEMPLATES = (Object.keys(TEMPLATE_LABELS) as (keyof typeof TEMPLATE_LABELS)[]).map((id) => ({
  id,
  label: TEMPLATE_LABELS[id],
}));

export type FieldError = { field?: string; message: string };

// Server Action 결과. 성공하면 대부분 redirect하므로 ok는 redirect하지 않는 동작만 쓴다
export type ActionState = { ok: true; slug?: string } | { error: FieldError } | null;

export type OnboardingInput = {
  usage: string;
  name: string;
  slug: string;
  teamSize: string;
  projectName: string;
  template: string;
  invites: string[];
};
