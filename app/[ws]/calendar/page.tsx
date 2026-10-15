// 캘린더 화면. 모든 프로젝트의 마감과 일정을 월·주 그리드로 보인다. 보는 달은 ?m=, 주는 ?w=, 뷰 상태는 cal 키로 저장한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarView } from "@/components/schedule/calendar-view";
import { PageHeader } from "@/components/shell/page-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { getWorkspaceProjects } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { calendarRange, parseCalendarParams, todayIso } from "@/lib/schedule/dates";
import { getEvents } from "@/lib/schedule/queries";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.calendar };

type Props = {
  params: Promise<{ ws: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CalendarPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const now = new Date();
  const today = todayIso(now);
  const { anchor, mode } = parseCalendarParams(query, today);
  const [items, viewState, members, labels, projects, events] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id }),
    getViewState(workspace.id, "cal"),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getWorkspaceProjects(workspace.id),
    getEvents({ workspaceId: workspace.id, ...calendarRange(anchor, mode) }),
  ]);

  return (
    <>
      <PageHeader title={NAV_LABELS.calendar} subtitle="모든 프로젝트의 마감과 일정" />
      <TaskStoreProvider
        initialItems={items}
        workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
        members={members}
        labels={labels}
        meId={userId}
      >
        <CalendarView
          viewKey="cal"
          initialState={viewState}
          events={events}
          anchor={anchor}
          mode={mode}
          todayIso={today}
          nowIso={now.toISOString()}
          legend={projects}
        />
      </TaskStoreProvider>
    </>
  );
}
