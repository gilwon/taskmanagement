// 프로젝트 목록 화면 골격. 워크스페이스의 모든 프로젝트를 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.projects };

export default function ProjectsPage() {
  return <StubPage title={NAV_LABELS.projects} subtitle="워크스페이스의 모든 프로젝트를 봅니다." />;
}
