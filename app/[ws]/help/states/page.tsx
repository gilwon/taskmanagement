// 개발 전용 화면 상태 화면 골격. 운영 빌드에서는 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.states };

export default function HelpStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StubPage title={NAV_LABELS.states} subtitle="빈 상태·로딩·오류·확인 상태를 모아 봅니다." />;
}
