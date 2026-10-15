// 작업 화면. 모든 프로젝트의 작업을 목록·보드·표(?view=)로 보인다. 뷰 상태는 tasks 키로 저장한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { TaskViews } from "@/components/tasks/views/task-views";
import { getWorkspaceProjects } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

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
          projects={projects}
          nowIso={new Date().toISOString()}
        />
      </TaskStoreProvider>
    </>
  );
}
