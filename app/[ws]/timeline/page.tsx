// 타임라인 화면. 프로젝트 전반의 일정·의존성·마일스톤을 일 단위 그리드로 보인다. 뷰 상태는 tl 키로 저장하고 처음에는 프로젝트별로 묶는다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/schedule/timeline";
import { PageHeader } from "@/components/shell/page-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { hasViewState } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { todayIso } from "@/lib/schedule/dates";
import { getMilestones } from "@/lib/schedule/queries";
import { getTaskItems, getViewState, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.timeline };

export default async function TimelinePage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [items, viewState, stored, members, labels, milestones] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id }),
    getViewState(workspace.id, "tl"),
    hasViewState(workspace.id, "tl"),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getMilestones({ workspaceId: workspace.id }),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader title={NAV_LABELS.timeline} subtitle="프로젝트 전반의 일정, 의존성, 마일스톤" />
      <TaskStoreProvider
        initialItems={items}
        workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
        members={members}
        labels={labels}
        meId={userId}
      >
        <Timeline
          viewKey="tl"
          initialState={stored ? viewState : { ...viewState, group: "project" }}
          milestones={milestones}
          todayIso={todayIso(now)}
          nowIso={now.toISOString()}
        />
      </TaskStoreProvider>
    </>
  );
}
