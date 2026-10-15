// 팀 화면 골격. 팀과 팀이 맡은 프로젝트를 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.teams };

export default function TeamsPage() {
  return <StubPage title={NAV_LABELS.teams} subtitle="팀과 팀이 맡은 프로젝트를 봅니다." />;
}
