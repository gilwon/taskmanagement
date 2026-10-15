// 캘린더 화면 골격. 모든 프로젝트의 마감일과 일정을 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.calendar };

export default function CalendarPage() {
  return <StubPage title={NAV_LABELS.calendar} subtitle="모든 프로젝트의 마감일과 일정을 봅니다." />;
}
