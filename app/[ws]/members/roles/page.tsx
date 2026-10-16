// 역할과 권한 화면. 구성원 탭의 세 번째 화면으로 역할별 권한 표를 읽기 전용으로 보인다
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { OrgTabs } from "@/components/org/org-tabs";
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { canOpenOrg } from "@/lib/org/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("org.permissions.title") };
}

export default async function RolesPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const t = await getT();
  const workspace = await getWorkspace(ws);
  if (!workspace) notFound();
  if (!(await canOpenOrg(ws))) forbidden();
  return (
    <>
      <PageHeader
        title={t("org.permissions.title")}
        subtitle={t("org.permissions.subtitle")}
      />
      <OrgTabs wsSlug={workspace.slug} />
      <div className="px-(--gutter) pb-(--s-8)">
        <RolePermissionsTable />
      </div>
    </>
  );
}
