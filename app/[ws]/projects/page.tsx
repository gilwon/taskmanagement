// 프로젝트 목록 화면. 워크스페이스의 삭제되지 않은 프로젝트(보관 포함)를 진행률·리드·기한·구성원과 함께 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewProjectButton, ProjectsView } from "@/components/projects/projects-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getProjectSummaries } from "@/lib/projects/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.projects };

export default async function ProjectsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [projects, members] = await Promise.all([
    getProjectSummaries(workspace.id, userId),
    getWorkspaceMembers(workspace.id),
  ]);
  // 게스트는 프로젝트를 만들 수 없다(create_project가 거부한다)
  const canCreate = members.find((m) => m.id === userId)?.role !== "guest";
  const live = projects.filter((p) => !p.archivedAt).length;

  return (
    <>
      <PageHeader
        title={NAV_LABELS.projects}
        subtitle={`진행 중인 프로젝트 ${live}개${live < projects.length ? ` · 보관됨 ${projects.length - live}개` : ""}`}
        actions={canCreate ? <NewProjectButton /> : undefined}
      />
      <ProjectsView
        projects={projects}
        members={members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        meId={userId}
        workspace={{ id: workspace.id, slug: workspace.slug }}
        canCreate={canCreate}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
