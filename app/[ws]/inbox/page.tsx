// 수신함 화면. 멘션·담당자 지정·댓글·업데이트 알림을 목록과 미리보기로 보이고 읽음 처리한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InboxView } from "@/components/notifications/inbox-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { getNotifications } from "@/lib/notifications/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("common.nav.inbox") };
}

export default async function InboxPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const t = await getT();
  const [items, members] = await Promise.all([getNotifications(workspace.id, userId), getWorkspaceMembers(workspace.id)]);
  return (
    <>
      <PageHeader title={t("common.nav.inbox")} subtitle={t("notifications.inboxSubtitle")} />
      <InboxView
        initial={items}
        workspace={{ id: workspace.id, slug: workspace.slug }}
        colors={Object.fromEntries(members.map((m) => [m.id, m.color]))}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
