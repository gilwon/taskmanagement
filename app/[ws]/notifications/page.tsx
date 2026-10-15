// 알림 화면. 받은 알림을 전체·읽지 않음으로 나눠 날짜별로 보이고 읽음 처리한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getNotifications } from "@/lib/notifications/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.notifications };

export default async function NotificationsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [items, members] = await Promise.all([getNotifications(workspace.id, userId), getWorkspaceMembers(workspace.id)]);
  return (
    <>
      <PageHeader title={NAV_LABELS.notifications} subtitle="워크스페이스에서 받은 알림을 날짜별로 봅니다." />
      <NotificationsView
        initial={items}
        workspace={{ id: workspace.id, slug: workspace.slug }}
        colors={Object.fromEntries(members.map((m) => [m.id, m.color]))}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
