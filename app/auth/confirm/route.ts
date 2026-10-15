// 이메일 링크(가입 확인·비밀번호 재설정) 처리. token_hash 또는 PKCE code를 세션으로 바꾼 뒤 next로 보낸다
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const target = request.nextUrl.clone();
  target.search = "";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && (OTP_TYPES as string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    // 링크를 요청한 브라우저의 code verifier 쿠키가 있어야 성공한다
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
    return NextResponse.redirect(target);
  }

  // safeNext는 경로만 돌려주므로 같은 출처로 보낸다
  return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), request.nextUrl.origin));
}
