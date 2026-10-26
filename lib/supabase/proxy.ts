// proxy에서 호출하는 세션 갱신 함수. 쿠키를 갱신하고 비로그인 요청을 /login으로, 로그인 사용자의 로그인·가입 화면 요청을 /로 보낸다
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";
import { isMfaExemptPath, mfaStepPath, needsMfaStep } from "@/lib/auth/mfa";
import { isGuestOnlyPath, isPublicPath, safeNext } from "@/lib/safe-next";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let supabaseResponse = NextResponse.next({ request });
  // setAll이 넘긴 캐시 금지 헤더. 리다이렉트 응답에도 붙인다
  let authHeaders: Record<string, string> = {};

  // 요청마다 새 클라이언트를 만든다. 재사용하면 캐시 금지 헤더가 빠진다
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        authHeaders = { ...authHeaders, ...headers };
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // createServerClient와 getClaims 사이에 코드를 넣지 않는다. 세션이 무작위로 끊길 수 있다
  // getClaims는 JWT 서명을 검증한다. getSession 결과는 믿지 않는다
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname, search } = request.nextUrl;
  // 갱신·삭제된 세션 쿠키와 캐시 금지 헤더를 리다이렉트 응답에도 옮긴다
  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(authHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  };

  if (!claims && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", safeNext(pathname + search));
    return redirectTo(loginUrl);
  }

  // 로그인 상태로 로그인·가입·비밀번호 찾기에 오면 /로 보낸다. 워크스페이스 분기는 app/page.tsx가 한다
  if (claims && isGuestOnlyPath(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return redirectTo(homeUrl);
  }

  // 비밀번호로만 들어온 세션(aal1)이 검증된 2단계 인증 요소를 가졌으면 코드 확인 화면으로 보낸다. 마지막 방어선이다.
  // 클레임에는 요소 정보가 없고 쿠키의 user는 믿을 수 없어 getUser로 서버에 확인한다. aal1이고 익명이 아닐 때만 호출한다.
  // 확인 화면·로그아웃은 aal1에서도 열려야 한다. 조회가 실패하면 막지 않는다
  if (claims && claims.aal === "aal1" && claims.is_anonymous !== true && !isPublicPath(pathname) && !isMfaExemptPath(pathname)) {
    const { data: userData } = await supabase.auth.getUser();
    const verified = userData.user?.factors?.some((factor) => factor.status === "verified");
    if (needsMfaStep(claims.aal, verified ? "aal2" : "aal1")) {
      const mfaUrl = request.nextUrl.clone();
      const target = mfaStepPath(pathname + search);
      mfaUrl.pathname = "/login/mfa";
      mfaUrl.search = target.slice(target.indexOf("?"));
      return redirectTo(mfaUrl);
    }
  }

  return supabaseResponse;
}
