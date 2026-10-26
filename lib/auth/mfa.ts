// 2단계 인증(TOTP) 순수 규칙. 코드 형식 검사, MFA 단계 필요 여부, 단계 화면 주소를 정한다
import { safeNext } from "@/lib/safe-next";

// 인증 앱이 보여주는 6자리 숫자 코드
export const TOTP_CODE_RE = /^\d{6}$/;

// 입력 칸의 공백을 지운 뒤 6자리 숫자인지 본다
export function normalizeTotpCode(value: string) {
  const code = value.replace(/\s+/g, "");
  return TOTP_CODE_RE.test(code) ? code : null;
}

// 비밀번호로만 들어왔고(aal1) 검증된 2단계 인증 요소가 있으면(nextLevel aal2) 코드 확인이 더 필요하다
export function needsMfaStep(currentLevel: string | null | undefined, nextLevel: string | null | undefined) {
  return currentLevel === "aal1" && nextLevel === "aal2";
}

// 로그인 후 코드 확인 화면. next는 safeNext로 한 번 더 거른다
export function mfaStepPath(next: string | null | undefined) {
  return `/login/mfa?next=${encodeURIComponent(safeNext(next))}`;
}

// 코드 확인 화면과 로그아웃은 aal1에서도 열려야 한다. 그렇지 않으면 무한 리다이렉트가 된다
export function isMfaExemptPath(pathname: string) {
  return pathname === "/login/mfa" || pathname === "/auth/signout";
}
