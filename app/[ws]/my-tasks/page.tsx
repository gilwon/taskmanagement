// 내 작업 화면. 나에게 배정된 작업을 기한별 목록이나 캘린더(?view=calendar)로 보인다. 뷰 상태는 mytasks 키로 저장한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyTasksView } from "@/components/my-tasks/my-tasks-view";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { parseCalendarParams, todayIso } from "@/lib/schedule/dates";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.myTasks };

type Props = {
  params: Promise<{ ws: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MyTasksPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [items, viewState, members, labels] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id }),
    getViewState(workspace.id, "mytasks"),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
  ]);
  const now = new Date();
  const today = todayIso(now);
  // 캘린더 모드가 보는 달(?m=)·주(?w=)
  const { anchor, mode } = parseCalendarParams(query, today);

  return (
    <TaskStoreProvider
      // 화면은 내 작업만 쓰므로 남의 작업은 내려보내지 않는다. 담당자를 바꾸면 화면이 store에서 다시 거른다
      initialItems={items.filter((t) => t.assignee_id === userId)}
      workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
      members={members}
      labels={labels}
      meId={userId}
    >
      <MyTasksView
        initialState={viewState}
        nowIso={now.toISOString()}
        calendar={{ anchor, mode, todayIso: today }}
      />
    </TaskStoreProvider>
  );
}
