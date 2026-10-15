// Next.js 16 proxy(이전 middleware). 모든 페이지 요청에서 Supabase 세션을 갱신하고 보호 경로를 막는다
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // _next 정적 파일·이미지 최적화, favicon, 이미지 확장자는 제외한다
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
