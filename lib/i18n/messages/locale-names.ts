// 로캘 표시명. 언어 선택 목록은 어느 언어 화면에서든 각 언어를 자국어로 보인다
import type { Locale } from "@/lib/i18n/locales";

export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
};
