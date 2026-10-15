"use server";
// 표시 언어 바꾸기 Server Action. 로그인 상태면 profiles.locale에 저장하고, 쿠키 locale을 1년으로 남긴다
import { writeLocaleCookie } from "@/lib/i18n/cookie";
import { isSelectableLocale } from "@/lib/i18n/locales";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(locale: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSelectableLocale(locale)) return { ok: false, error: (await getT())("errors.rpc.invalidInput") };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (sub) {
    const { error } = await supabase.from("profiles").update({ locale }).eq("id", sub);
    if (error) {
      console.error("[표시 언어]", error.code);
      return { ok: false, error: (await getT())("errors.generic") };
    }
  }
  await writeLocaleCookie(locale);
  return { ok: true };
}
