// Supabase 공개 환경변수를 읽는다. 누락되면 변수명을 담은 한국어 오류를 던진다
export function getSupabaseEnv() {
  // 브라우저 번들에 값이 인라인되도록 변수명을 리터럴로 읽는다
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `환경변수가 설정되지 않았습니다. ${missing.join(", ")} 값을 .env.local에 넣어 주세요.`,
    );
  }

  return { url, publishableKey };
}
