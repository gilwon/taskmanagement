// 보관함 화면. 보관·삭제한 프로젝트와 작업, 삭제한 댓글·파일을 복원하거나 영구 삭제한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/projects/archive-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { getTrash } from "@/lib/projects/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("common.nav.archive") };
}

export default async function ArchivePage({ params }: { params: Promise<{ ws: string }> }) {
  const t = await getT();
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [data, members] = await Promise.all([getTrash(workspace.id), getWorkspaceMembers(workspace.id)]);
  return (
    <>
      <PageHeader
        title={t("common.nav.archive")}
        subtitle={t("projects.page.archiveSubtitle")}
      />
      <ArchiveView
        data={data}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        meId={userId}
        wsSlug={workspace.slug}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
