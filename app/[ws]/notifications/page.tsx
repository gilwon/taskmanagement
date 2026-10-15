// 알림 화면 골격. 받은 알림을 날짜별로 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.notifications };

export default function NotificationsPage() {
  return <StubPage title={NAV_LABELS.notifications} subtitle="워크스페이스에서 받은 알림을 날짜별로 봅니다." />;
}
