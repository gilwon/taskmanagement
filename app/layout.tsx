// 루트 레이아웃. html 속성(로캘·테마·강조색·밀도·모션), 폰트, 기본 메타데이터, 사전·환경설정·툴팁·토스트 provider를 설정한다
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT, messagesFor } from "@/lib/i18n/server";
import { PREFS_SCRIPT } from "@/lib/prefs/prefs";
import { PrefsProvider } from "@/lib/prefs/provider";
import "./globals.css";

// 한글 폴백은 globals.css의 --font-sans 스택에 둔다
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("common.appName") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-theme="system"
      data-accent="indigo"
      data-density="comfortable"
      data-side="comfortable"
      data-motion="reduce"
      data-sidebar="expanded"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 저장된 환경설정을 첫 페인트 전에 html 속성으로 심는다. 서버 기본값은 위 속성이다 */}
        <InlineScript html={PREFS_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* 현재 로캘 사전 하나만 클라이언트로 넘긴다 */}
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          <PrefsProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster />
            </TooltipProvider>
          </PrefsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
