// 활동 화면 골격. 워크스페이스에서 일어난 변경 기록을 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.activity };

export default function ActivityPage() {
  return <StubPage title={NAV_LABELS.activity} subtitle="워크스페이스에서 일어난 변경 기록을 봅니다." />;
}
