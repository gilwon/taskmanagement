// Next.js 16 proxy(이전 middleware). 모든 페이지 요청에서 Supabase 세션을 갱신하고 보호 경로를 막는다
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    // proxy 오류는 앱 error.tsx를 거치지 않아 영어 기본 문구가 나간다. 원인은 서버 로그에 남기고 한국어로 답한다
    console.error(error);
    return new NextResponse("서버 설정 오류로 페이지를 열 수 없습니다. 관리자에게 문의해 주세요.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

export const config = {
  matcher: [
    // _next 정적 파일·이미지 최적화, favicon, 이미지 확장자는 제외한다
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
