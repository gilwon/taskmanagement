"use client";
// 보관함 본문. 삭제·보관된 프로젝트·작업과 삭제된 댓글·파일을 탭으로 보이고, 복원(토큰)·보관 해제·영구 삭제(확인 필수)를 한다
import { ArchiveRestore, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileTypeIcon } from "@/components/files/file-parts";
import { ProjectDot } from "@/components/home/parts";
import { ICON, LINK_CLS } from "@/components/projects/parts";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectIcon } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusIcon, TaskKey } from "@/components/tasks/parts";
import { announce } from "@/components/tasks/views/shared";
import { formatSize } from "@/lib/files/mime";
import { useFormatter, useT } from "@/lib/i18n/client";
import { ARCHIVE_TAB_LABELS } from "@/lib/i18n/labels";
import { purgeTrashItem, restoreTrashItem, unarchiveItem } from "@/lib/projects/actions";
import type { TrashData } from "@/lib/projects/queries";
import { canPurge, canRestore, restoreMode } from "@/lib/projects/trash";
import type { TrashKind } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type Tab = keyof typeof ARCHIVE_TAB_LABELS;

// 탭마다 같은 모양으로 그리는 한 줄
type Row = {
  kind: TrashKind;
  id: string;
  title: string;
  icon: React.ReactNode;
  // 보관된 프로젝트·작업은 아직 열 수 있다
  href: string | null;
  project: { name: string; color: string } | null;
  context: string | null;
  deletedAt: string | null;
  archivedAt: string | null;
  // 지운 사람. 댓글만 DB에 기록이 있다
  by: string | null;
  token: string;
  purgeable: boolean;
  restorable: boolean;
};

export function ArchiveView({
  data,
  members,
  meId,
  wsSlug,
  nowIso,
}: {
  data: TrashData;
  members: { id: string; name: string }[];
  meId: string;
  wsSlug: string;
  nowIso: string;
}) {
  const t = useT();
  const f = useFormatter();
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState<Tab>("projects");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    return (id: string | null) => (id ? (map.get(id) ?? t("common.unknownUser")) : null);
  }, [members, t]);

  const rows = useMemo<Record<Tab, Row[]>>(() => {
    const perm = (projectId: string) => data.perms[projectId];
    return {
      projects: data.projects.map((p) => ({
        kind: "project",
        id: p.id,
        title: p.name,
        icon: <ProjectIcon icon={p.icon} color={p.color} size={20} />,
        href: p.deletedAt ? null : `/${wsSlug}/projects/${encodeURIComponent(p.key)}/overview`,
        project: null,
        context: p.key,
        deletedAt: p.deletedAt,
        archivedAt: p.archivedAt,
        by: null,
        token: p.token,
        purgeable: canPurge("project", p, perm(p.id)),
        restorable: canRestore("project", p, perm(p.id), meId),
      })),
      tasks: data.tasks.map((task) => ({
        kind: "task",
        id: task.id,
        title: task.title,
        icon: <StatusIcon status={task.status} />,
        href: task.deletedAt ? null : `/${wsSlug}/task/${task.key}`,
        project: task.project,
        context: task.key,
        deletedAt: task.deletedAt,
        archivedAt: task.archivedAt,
        by: null,
        token: task.token,
        purgeable: canPurge("task", task, perm(task.project.id)),
        restorable: canRestore("task", task, perm(task.project.id), meId),
      })),
      comments: data.comments.map((c) => ({
        kind: "comment",
        id: c.id,
        title: c.body,
        icon: <MessageSquare {...ICON} className="text-(--text-3)" />,
        href: null,
        project: c.project,
        context: `${c.task.key} ${c.task.title} · ${t("projects.archive.writtenBy", { name: nameOf(c.authorId) ?? t("common.unknownUser") })}`,
        deletedAt: c.deletedAt,
        archivedAt: null,
        by: nameOf(c.deletedBy),
        token: c.token,
        purgeable: canPurge("comment", c, perm(c.project.id)),
        restorable: canRestore("comment", c, perm(c.project.id), meId),
      })),
      files: data.files.map((file) => ({
        kind: "file",
        id: file.id,
        title: file.name,
        icon: <FileTypeIcon type={file.type} size={16} />,
        href: null,
        project: file.project,
        context: `${formatSize(file.sizeBytes)} · ${t("projects.archive.uploadedBy", { name: nameOf(file.uploadedBy) ?? t("common.unknownUser") })}`,
        deletedAt: file.deletedAt,
        archivedAt: null,
        by: null,
        token: file.token,
        purgeable: canPurge("file", file, perm(file.project.id)),
        restorable: canRestore("file", file, perm(file.project.id), meId),
      })),
    };
  }, [data, wsSlug, nameOf, meId, t]);

  const restore = async (row: Row) => {
    setBusy(row.id);
    const r =
      restoreMode(row) === "restore"
        ? await restoreTrashItem(row.kind, row.id, row.token)
        : await unarchiveItem(row.kind as "project" | "task", row.id);
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      // 다른 사람이 바꿨거나 이미 처리됐을 수 있어 지금 상태로 다시 읽는다
      router.refresh();
      return;
    }
    announce(t("projects.archive.restoredItem", { name: row.title }));
    toast.success(restoreMode(row) === "restore" ? t("projects.archive.restored") : t("projects.archive.unarchived"));
  };

  const purge = async (row: Row) => {
    setBusy(row.id);
    const r = await purgeTrashItem(row.kind, row.id);
    setBusy(null);
    setConfirm(null);
    if (!r.ok) {
      toast.error(r.error);
      router.refresh();
      return;
    }
    announce(t("projects.archive.purgedItem", { name: row.title }));
    toast.success(t("projects.archive.purged"));
  };

  // 이름만 굵게 보이려고 문장 틀을 {name} 자리에서 나눈다
  const [confirmBefore, confirmAfter = ""] = t("projects.archive.confirmBody", { name: "{name}" }).split("{name}");

  return (
    <div className="px-(--gutter) pb-(--s-8)">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-(--s-3)">
        <TabsList variant="line" aria-label={t("projects.archive.tabs")} className="no-scrollbar h-10 max-w-full justify-start overflow-x-auto">
          {(Object.keys(ARCHIVE_TAB_LABELS) as Tab[]).map((k) => (
            <TabsTrigger key={k} value={k} className="flex-none px-2 text-(length:--fs-sm)">
              {t(`common.archiveTab.${k}`)}
              <span className="rounded-(--r-full) bg-(--surface-3) px-1.5 text-(length:--fs-2xs) text-(--text-3) tabular-nums">
                {rows[k].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(ARCHIVE_TAB_LABELS) as Tab[]).map((k) => (
          <TabsContent key={k} value={k}>
            {rows[k].length === 0 ? (
              <EmptyState icon={ArchiveRestore} title={t(`projects.archive.empty.${k}`)} description={t("projects.archive.emptyDescription")} />
            ) : (
              <ul className="overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
                {rows[k].map((row) => (
                  <li
                    key={row.id}
                    className="flex min-h-12 items-center gap-2.5 border-b border-(--divider) px-(--s-4) py-2 last:border-b-0 max-[640px]:flex-wrap"
                  >
                    <span className="flex shrink-0 items-center">{row.icon}</span>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="flex min-w-0 items-center gap-2">
                        {row.kind === "task" && row.context && <TaskKey value={row.context} />}
                        {row.href ? (
                          <Link href={row.href} className={cn(LINK_CLS, "min-w-0 truncate text-(--text)")}>
                            {row.title}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate text-(--text)">{row.title}</span>
                        )}
                        <span
                          className={cn(
                            "shrink-0 rounded-(--r-xs) px-1.5 text-(length:--fs-2xs)",
                            row.deletedAt ? "bg-(--red-soft) text-(--red)" : "bg-(--surface-3) text-(--text-3)",
                          )}
                        >
                          {row.deletedAt ? t("common.archiveState.deleted") : t("common.archiveState.archived")}
                        </span>
                      </span>
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-(length:--fs-xs) text-(--text-3)">
                        {row.project && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <ProjectDot color={row.project.color} />
                            <span className="truncate">{row.project.name}</span>
                          </span>
                        )}
                        {row.kind !== "task" && row.context && <span className="truncate">{row.project ? `· ${row.context}` : row.context}</span>}
                        <span>
                          ·{" "}
                          {row.deletedAt
                            ? row.by
                              ? t("projects.archive.deletedBy", { name: row.by })
                              : t("projects.archive.deleted")
                            : t("projects.archive.archived")}{" "}
                          ·{" "}
                          <time dateTime={row.deletedAt ?? row.archivedAt ?? undefined}>
                            {f.relative((row.deletedAt ?? row.archivedAt)!, now)}
                          </time>
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 max-[640px]:ml-auto">
                      {row.restorable && (
                        <Button size="xs" variant="outline" disabled={busy === row.id} onClick={() => void restore(row)}>
                          <RotateCcw {...ICON} />
                          {restoreMode(row) === "restore" ? t("projects.archive.restore") : t("projects.archive.unarchive")}
                        </Button>
                      )}
                      {row.purgeable && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-(--red) hover:bg-(--red-soft) hover:text-(--red)"
                          disabled={busy === row.id}
                          onClick={() => setConfirm(row)}
                        >
                          <Trash2 {...ICON} />
                          {t("projects.archive.purge")}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && busy === null && setConfirm(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-[440px] data-open:animate-[modalIn_.2s_var(--ease)] max-[640px]:max-w-[calc(100%-1rem)]">
          <DialogTitle className="px-4 pt-4 text-(length:--fs-md) font-semibold text-(--text)">{t("projects.archive.confirmTitle")}</DialogTitle>
          <DialogDescription className="px-4 pt-2 pb-4 text-(length:--fs-base) text-(--text-2)">
            {confirmBefore}
            <span className="font-medium text-(--text)">{confirm?.title}</span>
            {confirmAfter}
            {confirm?.kind === "project" && ` ${t("projects.archive.confirmProject")}`}
            {confirm?.kind === "task" && ` ${t("projects.archive.confirmTask")}`}
            {confirm?.kind === "file" && ` ${t("projects.archive.confirmFile")}`}
          </DialogDescription>
          <DialogFooter className="mx-0 mb-0 rounded-b-(--r-lg) border-t border-(--divider) bg-(--surface-2) px-4 py-3">
            <Button variant="outline" disabled={busy !== null} onClick={() => setConfirm(null)}>
              {t("common.action.cancel")}
            </Button>
            <Button variant="destructive" disabled={busy !== null} onClick={() => confirm && void purge(confirm)}>
              {busy !== null ? t("projects.archive.purging") : t("projects.archive.purge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
