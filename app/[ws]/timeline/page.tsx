// 타임라인 화면 골격. 프로젝트 전반의 일정·의존성·마일스톤을 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.timeline };

export default function TimelinePage() {
  return <StubPage title={NAV_LABELS.timeline} subtitle="프로젝트 전반의 일정, 의존성, 마일스톤을 봅니다." />;
}
