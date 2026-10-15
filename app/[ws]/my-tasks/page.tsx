// 내 작업 화면 골격. 나에게 배정된 작업을 기한별로 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.myTasks };

export default function MyTasksPage() {
  return <StubPage title={NAV_LABELS.myTasks} subtitle="나에게 배정된 작업을 기한별로 봅니다." />;
}
