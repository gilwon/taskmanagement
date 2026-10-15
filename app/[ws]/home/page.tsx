// 홈 화면 골격. 워크스페이스 전체 현황을 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.home };

export default function HomePage() {
  return <StubPage title={NAV_LABELS.home} subtitle="워크스페이스 전체에서 일어나는 일을 한눈에 봅니다." />;
}
