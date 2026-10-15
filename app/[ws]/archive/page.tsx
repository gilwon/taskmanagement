// 보관함 화면 골격. 보관·삭제한 작업과 프로젝트를 복원하거나 영구 삭제한다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.archive };

export default function ArchivePage() {
  return <StubPage title={NAV_LABELS.archive} subtitle="보관하거나 삭제한 작업과 프로젝트를 복원하거나 영구 삭제합니다." />;
}
