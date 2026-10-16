// 프로젝트 보드·목록·표·저장 뷰 페이지 공통 본문. 프로젝트·작업·뷰 상태를 서버에서 읽어 헤더와 작업 store·뷰를 그린다
import { notFound } from "next/navigation";
import { ProjectHeader } from "@/components/tasks/project-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { CurrentViewProvider } from "@/components/tasks/views/current-view";
import { TaskViews, type ViewMode } from "@/components/tasks/views/task-views";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { hasViewState, loadProject, type ProjectParams } from "@/lib/data/project";
import type { Json } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { canEditProject, getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";
import type { ViewKey } from "@/lib/tasks/types";
import { parseViewState } from "@/lib/tasks/view";

export async function ProjectTasksPage({
  params,
  mode,
  savedView,
}: {
  params: ProjectParams;
  mode: ViewMode;
  // 저장 뷰면 그 id와 저장된 필터. 뷰 키가 sv:{id}로 바뀐다
  savedView?: { id: string; filters: Json };
}) {
  const { ws } = await params;
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  const viewKey: ViewKey = savedView ? `sv:${savedView.id}` : `p:${project.id}`;
  const [items, viewState, members, labels, stored, perm] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id, projectId: project.id }),
    getViewState(workspace.id, viewKey),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    savedView ? hasViewState(workspace.id, viewKey) : true,
    canEditProject(project.id),
  ]);
  if (perm.error) {
    console.error("[프로젝트 권한]", perm.error.message);
    throw new Error((await getT())("tasks.errors.projectPermLoadFailed"));
  }
  // 저장 뷰를 처음 열면(사용자 설정 행 없음) 저장된 필터로 시작한다. 행이 있으면 사용자가 필터를 모두 지운 상태도 그대로 둔다
  const initialState = stored
    ? viewState
    : { ...viewState, filters: parseViewState({ filters: savedView?.filters }).filters };

  return (
    <CurrentViewProvider>
      <ProjectHeader
        wsSlug={workspace.slug}
        workspaceId={workspace.id}
        userId={userId}
        project={project}
        active={savedView ? { view: savedView.id } : mode}
      />
      <div className="pt-(--s-3)">
        <TaskStoreProvider
          initialItems={items}
          workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
          members={members}
          labels={labels}
          meId={userId}
        >
          <TaskViews
            viewKey={viewKey}
            initialState={initialState}
            mode={mode}
            showProject={false}
            projectId={project.id}
            projects={[
              {
                id: project.id,
                key: project.key,
                name: project.name,
                color: project.color,
                icon: project.icon,
                canEdit: perm.data === true,
              },
            ]}
            nowIso={new Date().toISOString()}
          />
        </TaskStoreProvider>
      </div>
    </CurrentViewProvider>
  );
}
