// 워크스페이스 개요 화면. 보관되지 않은 프로젝트의 진행률·열린 작업·기한 지남, 상태별 작업, 담당자 부하, 다가오는 마일스톤을 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceOverview } from "@/components/projects/workspace-overview";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getProjectSummaries } from "@/lib/projects/queries";
import { getMilestones } from "@/lib/schedule/queries";
import { todayIso } from "@/lib/schedule/dates";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.overview };

const MILESTONE_MAX = 6;

export default async function OverviewPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [projects, members, milestones] = await Promise.all([
    getProjectSummaries(workspace.id, userId),
    getWorkspaceMembers(workspace.id),
    getMilestones({ workspaceId: workspace.id }),
  ]);
  const now = new Date();
  const today = todayIso(now);
  const live = projects.filter((p) => !p.archivedAt);

  return (
    <>
      <PageHeader title={NAV_LABELS.overview} subtitle="워크스페이스의 프로젝트와 작업 현황을 한눈에 봅니다." />
      <WorkspaceOverview
        projects={live}
        members={members.map((m) => ({ id: m.id, name: m.name, color: m.color, status: m.status }))}
        milestones={milestones.filter((m) => m.date >= today).slice(0, MILESTONE_MAX)}
        wsSlug={workspace.slug}
        nowIso={now.toISOString()}
      />
    </>
  );
}
