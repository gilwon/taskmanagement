// 프로젝트 캘린더 탭. 그 프로젝트의 마감과 일정을 월·주 그리드로 보인다. 뷰 상태는 목록·보드·표와 같은 p:{프로젝트 id} 키를 쓴다
import { notFound } from "next/navigation";
import { CalendarView } from "@/components/schedule/calendar-view";
import { ProjectHeader } from "@/components/tasks/project-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { loadProject, projectMetadata, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { calendarRange, parseCalendarParams, todayIso } from "@/lib/schedule/dates";
import { getEvents } from "@/lib/schedule/queries";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";
import type { ViewKey } from "@/lib/tasks/types";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "calendar");
}

export default async function ProjectCalendarPage({
  params,
  searchParams,
}: {
  params: ProjectParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  const now = new Date();
  const today = todayIso(now);
  const { anchor, mode } = parseCalendarParams(query, today);
  const viewKey: ViewKey = `p:${project.id}`;
  const [items, viewState, members, labels, events] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id, projectId: project.id }),
    getViewState(workspace.id, viewKey),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getEvents({ workspaceId: workspace.id, projectId: project.id, ...calendarRange(anchor, mode) }),
  ]);

  return (
    <>
      <ProjectHeader
        wsSlug={workspace.slug}
        workspaceId={workspace.id}
        userId={userId}
        project={project}
        active="calendar"
      />
      <div className="pt-(--s-3)">
        <TaskStoreProvider
          initialItems={items}
          workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
          members={members}
          labels={labels}
          meId={userId}
        >
          <CalendarView
            viewKey={viewKey}
            initialState={viewState}
            events={events}
            anchor={anchor}
            mode={mode}
            todayIso={today}
            nowIso={now.toISOString()}
            projectId={project.id}
          />
        </TaskStoreProvider>
      </div>
    </>
  );
}
