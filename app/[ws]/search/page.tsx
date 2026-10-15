// 검색 화면 골격. 작업·프로젝트·사람·파일·댓글을 검색한다. 기능은 이후 단계에서 채운다
import type { Metadata } from "next";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.search };

export default function SearchPage() {
  return <StubPage title={NAV_LABELS.search} subtitle="작업·프로젝트·사람·파일·댓글을 검색합니다." />;
}
