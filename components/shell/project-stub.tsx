// 프로젝트 하위 탭 골격 화면. 프로젝트 머리말과 탭을 보이고 준비 중 안내를 띄운다
import { Construction } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectHeader } from "@/components/tasks/project-header";
import { loadProject, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import type { ProjectTab } from "@/lib/i18n/labels";

export async function ProjectStubPage({ params, tab }: { params: ProjectParams; tab: ProjectTab }) {
  const { ws } = await params;
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  return (
    <>
      <ProjectHeader wsSlug={workspace.slug} workspaceId={workspace.id} userId={userId} project={project} active={tab} />
      <div className="pt-(--s-6)">
        <EmptyState
          icon={Construction}
          title="다음 단계에서 구현됩니다"
          description="이 화면의 기능은 아직 준비 중입니다. 경로와 화면 구성만 먼저 열어 두었습니다."
        />
      </div>
    </>
  );
}
