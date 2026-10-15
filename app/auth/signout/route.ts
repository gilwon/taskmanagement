// 끊긴 세션 정리. Auth 서버에 사용자·세션이 없으면 세션 쿠키를 지우고 /login으로 보낸다.
// Server Component는 쿠키를 지울 수 없어 페이지가 여기로 보낸다. 살아 있는 세션은 건드리지 않고 /로 보낸다(외부 링크로 로그아웃시키지 못하게)
import { NextResponse, type NextRequest } from "next/server";
import { isGoneSession } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.getUser();
  if (!isGoneSession(error?.code)) return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  // 사용자가 없어 서버 로그아웃은 실패하므로 이 브라우저의 쿠키만 지운다
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
}
