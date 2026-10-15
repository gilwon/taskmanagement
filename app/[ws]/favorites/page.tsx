// 즐겨찾기 화면. 즐겨찾기한 프로젝트와 작업을 모아 보이고 해제할 수 있다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoritesView } from "@/components/projects/favorites-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getFavorites } from "@/lib/projects/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.favorites };

export default async function FavoritesPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [{ projects, tasks }, members] = await Promise.all([
    getFavorites(workspace.id, userId),
    getWorkspaceMembers(workspace.id),
  ]);
  return (
    <>
      <PageHeader title={NAV_LABELS.favorites} subtitle="즐겨찾기한 프로젝트와 작업을 모아 봅니다." />
      <FavoritesView
        projects={projects}
        tasks={tasks}
        members={members.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        wsSlug={workspace.slug}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
