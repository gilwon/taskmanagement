// 설정 섹션 골격. 허용 목록 밖의 섹션은 404, 미제공 항목은 동작하는 척하지 않고 미제공으로 안내한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ban } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StubPage } from "@/components/shell/stub-page";
import { NAV_LABELS, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/i18n/labels";

type Params = Promise<{ ws: string; section: string }>;

function find(section: string) {
  return Object.hasOwn(SETTINGS_SECTIONS, section) ? SETTINGS_SECTIONS[section as SettingsSection] : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = find((await params).section);
  return found ? { title: `${NAV_LABELS.settings} ${found.label}` } : {};
}

export default async function SettingsSectionPage({ params }: { params: Params }) {
  const found = find((await params).section);
  if (!found) notFound();
  if ("unavailable" in found) {
    return (
      <>
        <PageHeader title={found.label} subtitle={`${NAV_LABELS.settings} · ${found.group}`} />
        <EmptyState icon={Ban} title="미제공" description="이 기능은 현재 제공하지 않습니다." />
      </>
    );
  }
  return <StubPage title={found.label} subtitle={`${NAV_LABELS.settings} · ${found.group}`} />;
}
