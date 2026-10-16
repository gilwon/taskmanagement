"use client";
// 루트 레이아웃까지 실패했을 때의 오류 화면. 자체 html·body와 전역 스타일을 직접 가진다
import "./globals.css";
import { useSyncExternalStore } from "react";
import { matchAcceptLanguage } from "@/lib/i18n/locales";
import enErrors from "@/lib/i18n/messages/en/errors";
import jaErrors from "@/lib/i18n/messages/ja/errors";
import koErrors from "@/lib/i18n/messages/ko/errors";
import zhErrors from "@/lib/i18n/messages/zh-CN/errors";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT } from "@/lib/i18n/t";

// 루트 레이아웃 밖이라 I18nProvider가 없고 로캘 쿠키(httpOnly)도 읽을 수 없어 브라우저 언어로 고른다.
// 서버 렌더와 첫 렌더는 ko로 두고 브라우저에서 바꾼다. 저장한 표시 언어와 다를 수 있다
const subscribeNone = () => () => {};
const browserLocale = () => matchAcceptLanguage(navigator.languages?.join(",") || navigator.language);

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(subscribeNone, browserLocale, () => "ko" as const);
  // errors 영역만 담은 t. 사전 전체를 싣지 않는다
  const t = createT({ errors: { ko: koErrors, en: enErrors, ja: jaErrors, "zh-CN": zhErrors }[locale] } as unknown as Messages, locale);
  return (
    <html lang={locale}>
      <body>
        <title>{t("errors.global.title")}</title>
        <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-(length:--fs-xl) font-semibold text-(--text)">{t("errors.global.heading")}</h1>
          <p className="text-(length:--fs-base) text-(--text-3)">
            {error.digest ? t("errors.retryWithCode", { code: error.digest }) : t("errors.global.retryLater")}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-(--h-md) rounded-(--r-sm) bg-(--accent) px-3 text-(length:--fs-sm) font-medium text-(--on-accent) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
          >
            {t("errors.global.retry")}
          </button>
        </main>
      </body>
    </html>
  );
}
