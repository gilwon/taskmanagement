// Supabase Auth 오류 코드와 RPC 오류 코드를 화면에 보일 안내로 바꾼다. 원문은 내보내지 않는다.
// 문구는 사전(errors 영역)에 있고, t를 넘기면 그 로캘로, 넘기지 않으면 한국어로 돌려준다
import { MIN_PASSWORD_LENGTH, type FieldError } from "@/lib/auth/rules";
import koErrors from "@/lib/i18n/messages/ko/errors";
import type { MessageKey, Messages } from "@/lib/i18n/messages/types";
import { createT, type T } from "@/lib/i18n/t";

// 한국어 기본값. 클라이언트 번들에 사전 전체가 실리지 않게 errors 영역만 담은 t를 만든다(errors.* 키만 찾을 수 있다)
const koT = createT({ errors: koErrors } as unknown as Messages, "ko");

export const GENERIC_ERROR = koErrors.generic;

// 입력 검증 문구의 한국어 값. 로캘별 문구는 t("errors.msg.<이름>")로 쓴다
export const MSG = koErrors.msg;

const AUTH_MESSAGES: Record<string, { field?: string; key: MessageKey }> = {
  invalid_credentials: { key: "errors.auth.invalidCredentials" },
  email_not_confirmed: { field: "email", key: "errors.auth.emailNotConfirmed" },
  email_address_invalid: { field: "email", key: "errors.auth.emailAddressInvalid" },
  weak_password: { field: "password", key: "errors.auth.weakPassword" },
  same_password: { field: "password", key: "errors.auth.samePassword" },
  over_email_send_rate_limit: { key: "errors.auth.emailRateLimit" },
  over_request_rate_limit: { key: "errors.auth.requestRateLimit" },
  otp_expired: { key: "errors.auth.linkExpired" },
  flow_state_expired: { key: "errors.auth.linkExpired" },
  flow_state_not_found: { key: "errors.auth.linkExpired" },
  bad_code_verifier: { key: "errors.auth.badCodeVerifier" },
  session_not_found: { key: "errors.msg.sessionExpired" },
  signup_disabled: { key: "errors.auth.signupDisabled" },
  email_provider_disabled: { key: "errors.auth.emailProviderDisabled" },
};

// 자리 표시자가 없는 키에 넘긴 min은 쓰이지 않는다
const toError = (found: { field?: string; key: MessageKey }, t: T): FieldError => ({
  ...(found.field ? { field: found.field } : {}),
  message: (t as (key: string, params: Record<string, number>) => string)(found.key, { min: MIN_PASSWORD_LENGTH }),
});

export function authErrorMessage(code: string | undefined | null, t: T = koT): FieldError {
  return code && Object.hasOwn(AUTH_MESSAGES, code) ? toError(AUTH_MESSAGES[code], t) : { message: t("errors.generic") };
}

const RPC_MESSAGES: Record<string, { field?: string; key: MessageKey }> = {
  unauthenticated: { key: "errors.msg.sessionExpired" },
  forbidden: { key: "errors.rpc.forbidden" },
  invalid_input: { key: "errors.rpc.invalidInput" },
  slug_invalid: { field: "slug", key: "errors.msg.slugInvalid" },
  slug_taken: { field: "slug", key: "errors.rpc.slugTaken" },
};

// RPC는 errcode P0001일 때만 message가 고정 코드다. 그 밖의 코드는 내부 정보이므로 일반 안내로 바꾼다
export function rpcErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  t: T = koT,
): FieldError {
  if (error?.code === "P0001" && error.message && Object.hasOwn(RPC_MESSAGES, error.message)) {
    return toError(RPC_MESSAGES[error.message], t);
  }
  return { message: t("errors.generic") };
}
