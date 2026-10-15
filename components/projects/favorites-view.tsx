"use client";
// 즐겨찾기 본문. 즐겨찾기한 프로젝트 카드와 작업 목록, 해제(★) 버튼, 최근 추가순·이름순 정렬
import { ArrowDownWideNarrow, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, ProjectDot } from "@/components/home/parts";
import { ICON, LINK_CLS, MENU_CLASS, TOOLBAR_BTN } from "@/components/projects/parts";
import { EmptyState } from "@/components/shell/empty-state";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DueLabel, PriorityIcon, StatusIcon, TaskKey } from "@/components/tasks/parts";
import { announce } from "@/components/tasks/views/shared";
import { ARCHIVE_STATE_LABELS, FAVORITE_SORT_LABELS, PROJECT_STATUS_LABELS } from "@/lib/i18n/labels";
import { removeFavorite } from "@/lib/projects/actions";
import type { FavoriteProject, FavoriteTask } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

type Sort = keyof typeof FAVORITE_SORT_LABELS;

const archivedBadge = "shrink-0 rounded-(--r-xs) bg-(--surface-3) px-1.5 text-(length:--fs-2xs) text-(--text-3)";

function Unstar({ favoriteId, label }: { favoriteId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-pressed
      aria-label={`${label} 즐겨찾기 해제`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await removeFavorite(favoriteId);
        setBusy(false);
        if (!r.ok) return void toast.error(r.error);
        announce(`${label} 즐겨찾기를 해제했습니다`);
      }}
    >
      <Star {...ICON} className="fill-(--amber) text-(--amber)" />
    </Button>
  );
}

export function FavoritesView({
  projects,
  tasks,
  members,
  wsSlug,
  nowIso,
}: {
  projects: FavoriteProject[];
  tasks: FavoriteTask[];
  members: { id: string; name: string; color: string }[];
  wsSlug: string;
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [sort, setSort] = useState<Sort>("recent");
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  // 서버가 최근 추가순으로 내려 준다
  const shownProjects = useMemo(
    () => (sort === "name" ? [...projects].sort((a, b) => a.name.localeCompare(b.name, "ko")) : projects),
    [projects, sort],
  );
  const shownTasks = useMemo(
    () => (sort === "name" ? [...tasks].sort((a, b) => a.title.localeCompare(b.title, "ko")) : tasks),
    [tasks, sort],
  );

  if (projects.length === 0 && tasks.length === 0) {
    return (
      <EmptyState icon={Star} title="아직 즐겨찾기가 없습니다" description="프로젝트나 작업에 별표를 눌러 여기에 모아 보세요." />
    );
  }

  return (
    <div className="flex flex-col gap-(--s-4) px-(--gutter) pb-(--s-8)">
      <div role="toolbar" aria-label="즐겨찾기 보기 설정" className="flex items-center gap-(--s-1)">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={TOOLBAR_BTN}>
              <ArrowDownWideNarrow {...ICON} />
              정렬: {FAVORITE_SORT_LABELS[sort]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CLASS}>
            <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
              {(Object.keys(FAVORITE_SORT_LABELS) as Sort[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {FAVORITE_SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section aria-labelledby="fav-projects" className="flex flex-col gap-(--s-2)">
        <h2 id="fav-projects" className="text-(length:--fs-md) font-semibold text-(--text)">
          프로젝트 <span className="font-normal text-(--text-3)">{projects.length}</span>
        </h2>
        {shownProjects.length === 0 ? (
          <p className="text-(length:--fs-sm) text-(--text-3)">즐겨찾기한 프로젝트가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-(--s-3) max-[480px]:grid-cols-1">
            {shownProjects.map((p) => (
              <li key={p.favoriteId} className="flex min-w-0 items-center gap-2.5 rounded-(--r-lg) bg-(--surface) px-(--s-3) py-(--s-3) shadow-(--shadow-card)">
                <ProjectIcon icon={p.icon} color={p.color} size={28} className="rounded-(--r-sm)" />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/${wsSlug}/projects/${encodeURIComponent(p.key)}/overview`}
                    className={cn(LINK_CLS, "block truncate font-medium text-(--text)")}
                  >
                    {p.name}
                  </Link>
                  <span className="flex items-center gap-1.5 text-(length:--fs-xs) text-(--text-3)">
                    <ProjectStatusDot status={p.status} />
                    <span aria-hidden>{PROJECT_STATUS_LABELS[p.status]}</span>
                    {p.archived && <span className={archivedBadge}>{ARCHIVE_STATE_LABELS.archived}</span>}
                  </span>
                </span>
                <Unstar favoriteId={p.favoriteId} label={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel title={`작업 ${tasks.length}`} titleId="fav-tasks">
        {shownTasks.length === 0 ? (
          <p className="px-(--s-4) py-(--s-5) text-center text-(length:--fs-sm) text-(--text-3)">즐겨찾기한 작업이 없습니다</p>
        ) : (
          <ul>
            {shownTasks.map((t) => {
              const a = t.assigneeId ? byId.get(t.assigneeId) : undefined;
              const done = t.status === "done";
              return (
                <li
                  key={t.favoriteId}
                  className="flex h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--s-3) last:border-b-0 hover:bg-(--surface-2)"
                >
                  <StatusIcon status={t.status} />
                  <TaskKey value={t.key} className="hide-m" />
                  <Link
                    href={`/${wsSlug}/task/${t.key}`}
                    className={cn(LINK_CLS, "min-w-0 flex-1 truncate text-(--text)", done && "text-(--text-3) line-through")}
                  >
                    {t.title}
                  </Link>
                  {t.archived && <span className={archivedBadge}>{ARCHIVE_STATE_LABELS.archived}</span>}
                  <span className="hide-m flex max-w-36 shrink-0 items-center gap-1.5 text-(length:--fs-xs) text-(--text-3)">
                    <ProjectDot color={t.project.color} />
                    <span className="truncate">{t.project.name}</span>
                  </span>
                  <PriorityIcon priority={t.priority} size={14} />
                  {a && <MemberAvatar name={a.name} color={a.color} size={20} className="hide-m" />}
                  <DueLabel due={t.dueDate} done={done} now={now} className="w-14 shrink-0 text-right text-(length:--fs-sm)" />
                  <Unstar favoriteId={t.favoriteId} label={t.title} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
