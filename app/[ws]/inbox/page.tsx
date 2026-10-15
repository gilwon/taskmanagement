// 수신함 화면 골격. 멘션·담당자 지정·댓글·업데이트를 모아 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.inbox };

export default function InboxPage() {
  return <StubPage title={NAV_LABELS.inbox} subtitle="멘션·담당자 지정·댓글·업데이트를 한곳에서 확인합니다." />;
}
