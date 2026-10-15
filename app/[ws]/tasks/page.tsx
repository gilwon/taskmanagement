// 작업 화면. 모든 프로젝트의 작업을 목록·보드·표(?view=)로 보인다. 뷰 상태는 tasks 키로 저장한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { TaskViews } from "@/components/tasks/views/task-views";
import { getWorkspaceProjects } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { canEditProject, getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.tasks };

export default async function TasksPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [items, viewState, members, labels, projects] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id }),
    getViewState(workspace.id, "tasks"),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getWorkspaceProjects(workspace.id),
  ]);
  // 빠른 추가가 고를 프로젝트의 편집 권한. 작업 조회가 이미 물은 프로젝트는 cache가 다시 묻지 않는다
  const perms = await Promise.all(projects.map((p) => canEditProject(p.id)));
  const failed = perms.find((r) => r.error)?.error;
  if (failed) {
    console.error("[프로젝트 권한]", failed.message);
    throw new Error("프로젝트 권한을 불러오지 못했습니다.");
  }

  return (
    <>
      <PageHeader title={NAV_LABELS.tasks} subtitle={`${projects.length}개 프로젝트의 모든 작업`} />
      <TaskStoreProvider
        initialItems={items}
        workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
        members={members}
        labels={labels}
        meId={userId}
      >
        <TaskViews
          viewKey="tasks"
          initialState={viewState}
          showProject
          projects={projects.map((p, i) => ({ ...p, canEdit: perms[i].data === true }))}
          nowIso={new Date().toISOString()}
        />
      </TaskStoreProvider>
    </>
  );
}
