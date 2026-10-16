// Next.js 16 proxy(이전 middleware). 모든 페이지 요청에서 Supabase 세션을 갱신하고 보호 경로를 막는다
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isSelectableLocale, matchAcceptLanguage } from "@/lib/i18n/locales";
import enErrors from "@/lib/i18n/messages/en/errors";
import jaErrors from "@/lib/i18n/messages/ja/errors";
import koErrors from "@/lib/i18n/messages/ko/errors";
import zhErrors from "@/lib/i18n/messages/zh-CN/errors";
import { updateSession } from "@/lib/supabase/proxy";

// proxy에서는 lib/i18n/server(next/headers)를 쓸 수 없어 요청의 쿠키·Accept-Language로 직접 고른다
function proxyFailedMessage(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isSelectableLocale(saved) ? saved : matchAcceptLanguage(request.headers.get("accept-language"));
  return { ko: koErrors, en: enErrors, ja: jaErrors, "zh-CN": zhErrors }[locale].proxyFailed;
}

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    // proxy 오류는 앱 error.tsx를 거치지 않아 영어 기본 문구가 나간다. 원인은 서버 로그에 남기고 요청 로캘로 답한다
    console.error(error);
    return new NextResponse(proxyFailedMessage(request), {
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
