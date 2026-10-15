// 데모 설정. 서버 환경변수 DEMO_ENABLED를 호출 시점에 읽고, 익명 로그인 사용자를 데모 사용자로 판정한다
import "server-only";

export function isDemoEnabled() {
  return process.env.DEMO_ENABLED === "true";
}

// 데모 사용자는 익명 로그인 사용자다. JWT 클레임과 Auth 사용자 객체 모두 is_anonymous를 갖는다
export function isDemoUser(user: { is_anonymous?: boolean } | null | undefined) {
  return user?.is_anonymous === true;
}
