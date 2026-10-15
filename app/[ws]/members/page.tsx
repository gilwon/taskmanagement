// 구성원 화면 골격. 워크스페이스 구성원과 역할을 관리한다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.members };

export default function MembersPage() {
  return <StubPage title={NAV_LABELS.members} subtitle="워크스페이스 구성원과 역할을 관리합니다." />;
}
