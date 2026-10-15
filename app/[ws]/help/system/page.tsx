// 개발 전용 디자인 시스템 화면 골격. 운영 빌드에서는 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.system };

export default function HelpSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StubPage title={NAV_LABELS.system} subtitle="버튼·입력·색·간격 등 디자인 시스템 요소를 모아 봅니다." />;
}
