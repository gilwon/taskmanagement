// 인증 화면 공용 레이아웃. 화면 가운데에 카드 하나를 두고 문서 제목 형식과 화면 전환 안내를 맡는다
import type { Metadata } from "next";
import { RouteAnnouncer } from "@/components/auth/route-announcer";
import { getT } from "@/lib/i18n/server";

// 워크스페이스가 없는 화면이라 "{뷰} · 작업 공간"으로 쓴다
export async function generateMetadata(): Promise<Metadata> {
  const app = (await getT())("common.appName");
  return { title: { template: `%s · ${app}`, default: app } };
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-[var(--gutter)] outline-none">
        {children}
      </main>
      <RouteAnnouncer />
    </>
  );
}
