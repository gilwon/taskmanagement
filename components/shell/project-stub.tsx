// 프로젝트 하위 탭 골격 화면. 프로젝트 머리말과 탭을 보이고 준비 중 안내를 띄운다
import { Construction } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectHeader } from "@/components/tasks/project-header";
import { loadProject, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import type { ProjectTab } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";

export async function ProjectStubPage({ params, tab }: { params: ProjectParams; tab: ProjectTab }) {
  const { ws } = await params;
  const [userId, workspace, project, t] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params), getT()]);
  if (!workspace) notFound();
  return (
    <>
      <ProjectHeader wsSlug={workspace.slug} workspaceId={workspace.id} userId={userId} project={project} active={tab} />
      <div className="pt-(--s-6)">
        <EmptyState
          icon={Construction}
          title={t("shell.stub.title")}
          description={t("shell.stub.description")}
        />
      </div>
    </>
  );
}
