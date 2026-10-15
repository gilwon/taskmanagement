"use client";
// 클라이언트 사전 provider. 루트 레이아웃이 현재 로캘 사전 하나만 넘기고, 하위 컴포넌트는 useT·useLocale·useFormatter로 쓴다
import { createContext, useContext, useMemo } from "react";
import { createFormatter } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT } from "@/lib/i18n/t";

type I18nValue = {
  locale: Locale;
  messages: Messages;
  t: ReturnType<typeof createT>;
  format: ReturnType<typeof createFormatter>;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, messages, t: createT(messages, locale), format: createFormatter(locale) }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT must be used inside I18nProvider");
  return value;
}

export const useT = () => useI18n().t;
export const useLocale = () => useI18n().locale;
export const useMessages = () => useI18n().messages;
export const useFormatter = () => useI18n().format;
