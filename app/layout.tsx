// 루트 레이아웃. html 속성(테마·강조색·밀도·모션), 폰트, 기본 메타데이터, 환경설정·툴팁·토스트 provider를 설정한다
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export const metadata: Metadata = {
  title: "작업 공간",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
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
        <PrefsProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster />
          </TooltipProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
