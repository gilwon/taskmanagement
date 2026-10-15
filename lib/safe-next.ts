// 로그인 리다이렉트용 경로 판정. 공개 경로 여부와 next 파라미터의 안전성을 검사한다

const PUBLIC_EXACT = ["/login", "/signup", "/verify"];
const PUBLIC_PREFIX = ["/forgot", "/reset", "/auth"];

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"))
  );
}

// 같은 출처 상대 경로만 통과시킨다. 그 외는 "/"로 바꿔 오픈 리다이렉트를 막는다
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  // 브라우저가 \를 /로 바꾸고 탭·개행을 지워 //evil.com이 되는 경우를 막는다
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}
