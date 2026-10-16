// 즐겨찾기 화면. 즐겨찾기한 프로젝트와 작업을 모아 보이고 해제할 수 있다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoritesView } from "@/components/projects/favorites-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { getFavorites } from "@/lib/projects/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("common.nav.favorites") };
}

export default async function FavoritesPage({ params }: { params: Promise<{ ws: string }> }) {
  const t = await getT();
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [{ projects, tasks }, members] = await Promise.all([
    getFavorites(workspace.id, userId),
    getWorkspaceMembers(workspace.id),
  ]);
  return (
    <>
      <PageHeader title={t("common.nav.favorites")} subtitle={t("projects.page.favoritesSubtitle")} />
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
