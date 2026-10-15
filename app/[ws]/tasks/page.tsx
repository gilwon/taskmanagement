// 작업 화면 골격. 모든 프로젝트의 작업을 한곳에 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.tasks };

export default function TasksPage() {
  return <StubPage title={NAV_LABELS.tasks} subtitle="모든 프로젝트의 작업을 한곳에서 봅니다." />;
}
