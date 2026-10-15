// 개요 화면 골격. 워크스페이스의 프로젝트와 작업 현황을 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.overview };

export default function OverviewPage() {
  return <StubPage title={NAV_LABELS.overview} subtitle="워크스페이스의 프로젝트와 작업 현황을 봅니다." />;
}
