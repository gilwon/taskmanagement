// 데모 로그인 설정. 서버 환경변수 DEMO_EMAIL·DEMO_PASSWORD를 호출 시점에 읽고 데모 계정을 판정한다
import "server-only";

// 둘 다 있을 때만 데모를 켠다. 값은 Next가 .env.local에서 dotenv 규칙으로 읽은 그대로다
// (따옴표 없는 값의 앞뒤 공백은 dotenv가 지운다). 비밀번호는 여기서 더 다듬지 않는다
export function demoCredentials() {
  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD;
  return email && password ? { email, password } : null;
}

export function isDemoEnabled() {
  return demoCredentials() !== null;
}

// 데모 계정이면 비밀번호 변경 등 공용 데모를 깨뜨리는 동작을 막는다. 환경변수가 없으면 늘 거짓
export function isDemoUser(email: string | null | undefined) {
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase();
  return Boolean(demo && email && email.trim().toLowerCase() === demo);
}
