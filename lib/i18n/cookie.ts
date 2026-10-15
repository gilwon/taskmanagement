// 로캘 쿠키 쓰기. Server Action에서만 부른다(렌더 중에는 쿠키를 쓸 수 없다)
import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isSelectableLocale, type Locale } from "@/lib/i18n/locales";
import type { createClient } from "@/lib/supabase/server";

export async function writeLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  });
}

// 로그인 직후 프로필에 저장한 로캘로 쿠키를 맞춘다. 다른 기기에서 고른 언어가 이어진다.
// 조회 실패나 사전 없는 로캘이면 지금 쿠키를 그대로 둔다
export async function syncLocaleCookie(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  if (isSelectableLocale(data?.locale)) await writeLocaleCookie(data.locale);
}
