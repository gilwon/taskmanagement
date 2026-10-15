"use client";
// 프로젝트 목록 본문. 검색·상태·내 프로젝트·보관 포함 필터, 정렬, 카드/목록/표 보기와 프로젝트 ⋯ 메뉴·우클릭 메뉴
import { ArrowDownWideNarrow, FolderKanban, FolderPlus, ListFilter, Lock, Search, SearchX, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ICON,
  LINK_CLS,
  MemberStack,
  MENU_CLASS,
  ProgressBar,
  ProjectContextMenu,
  ProjectMenu,
  SEARCH_INPUT,
  TOOLBAR_BTN,
} from "@/components/projects/parts";
import { useNewProject } from "@/components/projects/new-project-launcher";
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
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DueLabel } from "@/components/tasks/parts";
import {
  ARCHIVE_STATE_LABELS,
  NO_LEAD_LABEL,
  PROJECT_COLUMN_LABELS,
  PROJECT_SORT_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_VIEW_LABELS,
} from "@/lib/i18n/labels";
import { filterProjects, sortProjects } from "@/lib/projects/stats";
import type { ProjectFilter, ProjectSort, ProjectStatus, ProjectSummary } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ViewMode = keyof typeof PROJECT_VIEW_LABELS;
type Member = { id: string; name: string; color: string };

const STATUS_ALL_LABEL = "모든 상태";
const PRESSED = "aria-pressed:bg-(--accent-soft) aria-pressed:text-(--accent)";

type Props = {
  projects: ProjectSummary[];
  members: Member[];
  meId: string;
  workspace: { id: string; slug: string };
  canCreate: boolean;
  nowIso: string;
};

export function ProjectsView({ projects, members, meId, workspace, canCreate, nowIso }: Props) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState<ProjectFilter>({ q: "", status: "all", mine: false, archived: false });
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [mode, setMode] = useState<ViewMode>("table");
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const shown = useMemo(() => sortProjects(filterProjects(projects, filter, meId), sort), [projects, filter, meId, sort]);
  const set = <K extends keyof ProjectFilter>(k: K, v: ProjectFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));

  // 프로젝트 구성원과 작업 담당자를 합친 팀
  const teamOf = (p: ProjectSummary) =>
    [...new Set([...p.memberIds, ...p.tasks.flatMap((t) => (t.assignee_id ? [t.assignee_id] : []))])]
      .map((id) => byId.get(id))
      .filter((m) => m !== undefined);
  const lead = (p: ProjectSummary) => (p.leadId ? byId.get(p.leadId) : undefined);
  const href = (p: ProjectSummary) => `/${workspace.slug}/projects/${encodeURIComponent(p.key)}/overview`;
  const menuProject = (p: ProjectSummary) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    favorite: p.favorite,
    archivedAt: p.archivedAt,
    canManage: p.perm === "full",
  });
  const menu = (p: ProjectSummary) => <ProjectMenu workspaceId={workspace.id} project={menuProject(p)} />;

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="아직 프로젝트가 없습니다"
        description="프로젝트를 만들어 작업을 모아 보세요."
        action={canCreate ? <NewProjectButton /> : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-(--s-3) pb-(--s-8)">
      <div role="toolbar" aria-label="프로젝트 보기 설정" className="mx-(--gutter) flex flex-wrap items-center gap-(--s-1)">
        <div className="relative flex items-center">
          <Search {...ICON} className="pointer-events-none absolute left-2 text-(--text-4)" />
          <input
            type="search"
            value={filter.q}
            onChange={(e) => set("q", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && filter.q) {
                e.preventDefault();
                set("q", "");
              }
            }}
            placeholder="프로젝트 검색"
            aria-label="프로젝트 검색"
            className={SEARCH_INPUT}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={TOOLBAR_BTN}>
              <ListFilter {...ICON} />
              상태: {filter.status === "all" ? STATUS_ALL_LABEL : PROJECT_STATUS_LABELS[filter.status]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CLASS}>
            <DropdownMenuLabel>프로젝트 상태</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={filter.status} onValueChange={(v) => set("status", v as ProjectStatus | "all")}>
              <DropdownMenuRadioItem value="all">{STATUS_ALL_LABEL}</DropdownMenuRadioItem>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Toggle size="sm" pressed={filter.mine} onPressedChange={(v) => set("mine", v)} className={cn(TOOLBAR_BTN, PRESSED)}>
          내 프로젝트
        </Toggle>
        <Toggle size="sm" pressed={filter.archived} onPressedChange={(v) => set("archived", v)} className={cn(TOOLBAR_BTN, PRESSED)}>
          보관된 프로젝트 포함
        </Toggle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={TOOLBAR_BTN}>
              <ArrowDownWideNarrow {...ICON} />
              정렬: {PROJECT_SORT_LABELS[sort]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CLASS}>
            <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as ProjectSort)}>
              {(Object.keys(PROJECT_SORT_LABELS) as ProjectSort[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {PROJECT_SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={mode}
          aria-label="보기 방식"
          onValueChange={(v) => v && setMode(v as ViewMode)}
          className="ml-auto"
        >
          {(Object.keys(PROJECT_VIEW_LABELS) as ViewMode[]).map((m) => (
            <ToggleGroupItem key={m} value={m} className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
              {PROJECT_VIEW_LABELS[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="sr-only" aria-live="polite">
        프로젝트 {shown.length}개
      </p>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="검색 결과가 없습니다" description="조건에 맞는 프로젝트가 없습니다." />
      ) : mode === "list" ? (
        <ul className="mx-(--gutter) overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
          {shown.map((p) => (
            <ProjectContextMenu key={p.id} workspaceId={workspace.id} project={menuProject(p)}>
              <li className="flex h-11 items-center gap-3 border-b border-(--divider) px-(--s-4) text-(length:--fs-sm) last:border-b-0 hover:bg-(--surface-2)">
                <span className="min-w-0 flex-1">
                  <ProjectName p={p} href={href(p)} />
                </span>
                <span className="hide-m w-24 shrink-0">
                  <StatusText status={p.status} />
                </span>
                <ProgressBar pct={p.stats.pct} label={`${p.name} 진행률`} className="w-32 shrink-0 max-[640px]:w-20" />
                <DueLabel
                  due={p.dueDate}
                  done={p.status === "complete"}
                  now={now}
                  placeholder="—"
                  className="hide-m w-16 shrink-0 text-right text-(length:--fs-xs)"
                />
                {menu(p)}
              </li>
            </ProjectContextMenu>
          ))}
        </ul>
      ) : mode === "table" ? (
        <div className="mx-(--gutter) overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
          <table className="w-full table-fixed text-(length:--fs-sm)">
            <thead>
              <tr className="h-9 border-b border-(--divider) text-left text-(length:--fs-xs) text-(--text-3)">
                <th scope="col" className="px-(--s-4) font-medium">
                  {PROJECT_COLUMN_LABELS.project}
                </th>
                <th scope="col" className="hide-m w-32 font-medium max-[1100px]:hidden">
                  {PROJECT_COLUMN_LABELS.lead}
                </th>
                <th scope="col" className="hide-m w-24 font-medium">
                  {PROJECT_COLUMN_LABELS.status}
                </th>
                <th scope="col" className="w-36 font-medium max-[640px]:w-24">
                  {PROJECT_COLUMN_LABELS.progress}
                </th>
                <th scope="col" className="hide-m w-20 font-medium">
                  {PROJECT_COLUMN_LABELS.due}
                </th>
                <th scope="col" className="hide-m w-24 font-medium max-[1100px]:hidden">
                  {PROJECT_COLUMN_LABELS.members}
                </th>
                <th scope="col" className="w-10 pr-(--s-2)">
                  <span className="sr-only">동작</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const l = lead(p);
                return (
                  <ProjectContextMenu key={p.id} workspaceId={workspace.id} project={menuProject(p)}>
                  <tr className="h-11 border-b border-(--divider) last:border-b-0 hover:bg-(--surface-2)">
                    <td className="px-(--s-4)">
                      <ProjectName p={p} href={href(p)} />
                    </td>
                    <td className="hide-m max-[1100px]:hidden">
                      {l ? (
                        <span className="flex min-w-0 items-center gap-1.5 text-(--text-2)">
                          <MemberAvatar name={l.name} color={l.color} size={20} />
                          <span className="truncate">{l.name}</span>
                        </span>
                      ) : (
                        <span className="text-(--text-4)">{NO_LEAD_LABEL}</span>
                      )}
                    </td>
                    <td className="hide-m">
                      <StatusText status={p.status} />
                    </td>
                    <td>
                      <ProgressBar pct={p.stats.pct} label={`${p.name} 진행률`} className="pr-(--s-3)" />
                    </td>
                    <td className="hide-m">
                      <DueLabel due={p.dueDate} done={p.status === "complete"} now={now} placeholder="—" className="text-(length:--fs-xs)" />
                    </td>
                    <td className="hide-m max-[1100px]:hidden">
                      <MemberStack members={teamOf(p)} />
                    </td>
                    <td className="pr-(--s-2) text-right">{menu(p)}</td>
                  </tr>
                  </ProjectContextMenu>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mx-(--gutter) grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-(--s-3) max-[480px]:grid-cols-1">
          {shown.map((p) => {
            const l = lead(p);
            return (
              <ProjectContextMenu key={p.id} workspaceId={workspace.id} project={menuProject(p)}>
              <li className="flex min-w-0 flex-col gap-(--s-3) rounded-(--r-lg) bg-(--surface) p-(--s-4) shadow-(--shadow-card)">
                <div className="flex items-start gap-2">
                  <ProjectName p={p} href={href(p)} />
                  <span className="ml-auto">{menu(p)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-(length:--fs-xs)">
                  <StatusText status={p.status} />
                  <DueLabel due={p.dueDate} done={p.status === "complete"} now={now} placeholder="기한 없음" />
                </div>
                <ProgressBar pct={p.stats.pct} label={`${p.name} 진행률`} />
                <div className="flex items-center justify-between gap-2 text-(length:--fs-xs) text-(--text-3)">
                  <span className="truncate">
                    {l ? `리드 ${l.name}` : NO_LEAD_LABEL} · 열린 작업 {p.stats.open}개
                  </span>
                  <MemberStack members={teamOf(p)} />
                </div>
              </li>
              </ProjectContextMenu>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NewProjectButton() {
  const { openNewProject } = useNewProject();
  return (
    <Button size="sm" onClick={openNewProject}>
      <FolderPlus aria-hidden strokeWidth={1.8} />
      새 프로젝트
    </Button>
  );
}

function StatusText({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-(--text-2)">
      <ProjectStatusDot status={status} />
      <span aria-hidden>{PROJECT_STATUS_LABELS[status]}</span>
    </span>
  );
}

function ProjectName({ p, href }: { p: ProjectSummary; href: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ProjectIcon icon={p.icon} color={p.color} size={22} />
      <Link href={href} className={cn(LINK_CLS, "min-w-0 truncate font-medium text-(--text)")}>
        {p.name}
      </Link>
      <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-4)">{p.key}</span>
      {p.access === "private" && <Lock size={12} strokeWidth={1.8} role="img" aria-label="비공개" className="shrink-0 text-(--text-3)" />}
      {p.favorite && (
        <Star size={12} strokeWidth={1.8} role="img" aria-label="즐겨찾기" className="shrink-0 fill-(--amber) text-(--amber)" />
      )}
      {p.archivedAt && (
        <span className="shrink-0 rounded-(--r-xs) bg-(--surface-3) px-1.5 text-(length:--fs-2xs) text-(--text-3)">
          {ARCHIVE_STATE_LABELS.archived}
        </span>
      )}
    </span>
  );
}
