// 역할과 권한 화면. 구성원 탭의 세 번째 화면으로 역할별 권한 표를 읽기 전용으로 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgTabs } from "@/components/org/org-tabs";
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace } from "@/lib/data/workspace";

export const metadata: Metadata = { title: "역할과 권한" };

export default async function RolesPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const workspace = await getWorkspace(ws);
  if (!workspace) notFound();
  return (
    <>
      <PageHeader
        title="역할과 권한"
        subtitle="역할은 구성원 탭에서 소유자·관리자가 바꿉니다. 누구도 자기 역할을 스스로 바꿀 수 없습니다."
      />
      <OrgTabs wsSlug={workspace.slug} />
      <div className="px-(--gutter) pb-(--s-8)">
        <RolePermissionsTable />
      </div>
    </>
  );
}
