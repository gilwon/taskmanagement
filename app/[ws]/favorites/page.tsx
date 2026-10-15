// 즐겨찾기 화면 골격. 즐겨찾기한 프로젝트와 작업을 모아 보인다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.favorites };

export default function FavoritesPage() {
  return <StubPage title={NAV_LABELS.favorites} subtitle="즐겨찾기한 프로젝트와 작업을 모아 봅니다." />;
}
