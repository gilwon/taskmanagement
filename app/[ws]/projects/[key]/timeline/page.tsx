// 프로젝트 타임라인 탭. 그 프로젝트의 일정·의존성·마일스톤을 보인다. 뷰 상태는 목록·보드·표와 같은 p:{프로젝트 id} 키를 쓴다
import { notFound } from "next/navigation";
import { Timeline } from "@/components/schedule/timeline";
import { ProjectHeader } from "@/components/tasks/project-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { loadProject, projectMetadata, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { todayIso } from "@/lib/schedule/dates";
import { getMilestones } from "@/lib/schedule/queries";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";
import type { ViewKey } from "@/lib/tasks/types";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "timeline");
}

export default async function ProjectTimelinePage({ params }: { params: ProjectParams }) {
  const { ws } = await params;
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  const viewKey: ViewKey = `p:${project.id}`;
  const [items, viewState, members, labels, milestones] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id, projectId: project.id }),
    getViewState(workspace.id, viewKey),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getMilestones({ workspaceId: workspace.id, projectId: project.id }),
  ]);
  const now = new Date();

  return (
    <>
      <ProjectHeader
        wsSlug={workspace.slug}
        workspaceId={workspace.id}
        userId={userId}
        project={project}
        active="timeline"
      />
      <div className="pt-(--s-3)">
        <TaskStoreProvider
          initialItems={items}
          workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
          members={members}
          labels={labels}
          meId={userId}
        >
          <Timeline
            viewKey={viewKey}
            initialState={viewState}
            milestones={milestones}
            todayIso={todayIso(now)}
            nowIso={now.toISOString()}
            projectId={project.id}
          />
        </TaskStoreProvider>
      </div>
    </>
  );
}
