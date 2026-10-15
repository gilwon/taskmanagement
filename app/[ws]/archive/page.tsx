// 보관함 화면. 보관·삭제한 프로젝트와 작업, 삭제한 댓글·파일을 복원하거나 영구 삭제한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/projects/archive-view";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getTrash } from "@/lib/projects/queries";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: NAV_LABELS.archive };

export default async function ArchivePage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [data, members] = await Promise.all([getTrash(workspace.id), getWorkspaceMembers(workspace.id)]);
  return (
    <>
      <PageHeader
        title={NAV_LABELS.archive}
        subtitle="보관하거나 삭제한 항목을 되돌리거나 영구 삭제합니다. 영구 삭제는 전체 권한이 있는 사람만 할 수 있습니다."
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
