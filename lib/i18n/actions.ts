"use server";
// 표시 언어 바꾸기 Server Action. 로그인 상태면 profiles.locale에 저장하고, 쿠키 locale을 1년으로 남긴다.
// 성공 알림 문구는 새 로캘로 만들어 돌려준다(화면 사전은 refresh 뒤에야 바뀐다)
import { writeLocaleCookie } from "@/lib/i18n/cookie";
import { isSelectableLocale } from "@/lib/i18n/locales";
import { LOCALE_NAMES } from "@/lib/i18n/messages/locale-names";
import { getT, messagesFor } from "@/lib/i18n/server";
import { createT } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(locale: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
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
  // getT는 요청 단위 cache라 바뀐 쿠키를 보지 않는다. 새 로캘 사전으로 직접 만든다
  const t = createT(messagesFor(locale), locale);
  return { ok: true, message: t("org.settings.language.saved", { name: LOCALE_NAMES[locale] }) };
}
