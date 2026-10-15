// 서버 전용 로캘·사전 조회. 쿠키 locale → Accept-Language → ko 순서로 현재 로캘을 정하고 t·포매터를 만든다
import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createFormatter } from "@/lib/i18n/format";
import { LOCALE_COOKIE, isSelectableLocale, matchAcceptLanguage, type Locale } from "@/lib/i18n/locales";
import en from "@/lib/i18n/messages/en";
import ko from "@/lib/i18n/messages/ko";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT } from "@/lib/i18n/t";

// 사전이 아직 없는 로캘(ja·zh-CN)은 ko로 보인다
const MESSAGES: Partial<Record<Locale, Messages>> = { ko, en };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale] ?? ko;
}

// 요청마다 한 번만 읽는다. 사전이 없는 로캘 쿠키는 무시하고 브라우저 언어로 고른다
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isSelectableLocale(saved)) return saved;
  return matchAcceptLanguage((await headers()).get("accept-language"));
});

export async function getMessages() {
  return messagesFor(await getLocale());
}

export const getT = cache(async () => {
  const locale = await getLocale();
  return createT(messagesFor(locale), locale);
});

export const getFormatter = cache(async () => createFormatter(await getLocale()));
