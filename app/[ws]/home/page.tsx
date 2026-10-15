// 홈 화면. 인사·stat·내 작업·프로젝트 진행·다가오는 마감·최근 활동으로 워크스페이스 전체 현황을 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeActions, HomeView } from "@/components/home/home-view";
import { PageHeader } from "@/components/shell/page-header";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getHomeProjects, getRecentActivities } from "@/lib/home/queries";
import { NAV_LABELS, NAMELESS_MEMBER_LABEL } from "@/lib/i18n/labels";
import { getTaskItems, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.home };

const ACTIVITY_LIMIT = 8;

const hourFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" });
const todayFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "long",
});

// 서울 시각 5~11시 아침, 12~17시 오후, 그 밖은 저녁
function greeting(now: Date) {
  const hour = Number(hourFmt.formatToParts(now).find((p) => p.type === "hour")?.value);
  if (hour >= 5 && hour < 12) return "좋은 아침이에요";
  if (hour >= 12 && hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

export default async function HomePage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [items, members, labels, projects, activities] = await Promise.all([
    getTaskItems({ workspaceId: workspace.id }),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
    getHomeProjects(workspace.id),
    getRecentActivities(workspace.id, ACTIVITY_LIMIT),
  ]);
  const now = new Date();
  const name = members.find((m) => m.id === userId)?.name ?? NAMELESS_MEMBER_LABEL;

  return (
    <TaskStoreProvider
      initialItems={items}
      workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
      members={members}
      labels={labels}
      meId={userId}
    >
      <PageHeader
        title={`${greeting(now)}, ${name}님`}
        subtitle={`${todayFmt.format(now)} · 워크스페이스 전체에서 일어나는 일을 확인하세요.`}
        actions={<HomeActions />}
      />
      <HomeView projects={projects} activities={activities} nowIso={now.toISOString()} />
    </TaskStoreProvider>
  );
}
