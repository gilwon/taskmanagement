"use client";
// 사이드바 내비게이션. 워크스페이스 스위처, 개인·워크스페이스·프로젝트·팀 메뉴, 하단 사용자 카드(META §1)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  Calendar,
  ChartGantt,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  FolderKanban,
  House,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Lock,
  PanelLeftClose,
  Plus,
  Settings,
  Star,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetClose } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import type { ShellData, ShellProject } from "@/lib/data/workspace";
import { NAV_LABELS, PROJECT_TAB_LABELS, colorHex } from "@/lib/i18n/labels";
import { usePrefs } from "@/lib/prefs/provider";
import { cn } from "@/lib/utils";

export const PENDING_HINT = "아직 준비 중인 기능입니다.";

const rowClass =
  "flex h-(--side-row) min-w-0 items-center gap-2 rounded-(--r-sm) px-2 text-(length:--fs-base) text-(--text-2) outline-none transition-colors duration-(--dur) hover:bg-(--surface-3) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset active:bg-(--surface-3) aria-[current=page]:bg-(--surface-3) aria-[current=page]:font-medium aria-[current=page]:text-(--text)";

const iconProps = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

function NavItem({
  href,
  icon: Icon,
  label,
  count,
  emphasis = false,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  emphasis?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <li>
      <Link
        href={href}
        aria-current={pathname === href ? "page" : undefined}
        onClick={onNavigate}
        className={rowClass}
      >
        <Icon {...iconProps} className="shrink-0 text-(--text-3)" />
        <span className="truncate">{label}</span>
        {!!count &&
          (emphasis ? (
            <Badge variant="count" className="ml-auto">
              <span className="sr-only">, </span>
              {count}
              <span className="sr-only">개</span>
            </Badge>
          ) : (
            <span className="ml-auto shrink-0 text-(length:--fs-2xs) text-(--text-3) tabular-nums">
              <span className="sr-only">, </span>
              {count}
              <span className="sr-only">개</span>
            </span>
          ))}
      </Link>
    </li>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between pr-1 pl-2">
      <h2 className="text-(length:--fs-2xs) font-medium text-(--text-3)">{children}</h2>
      {action}
    </div>
  );
}

// 아직 동작하지 않는 + 버튼. 비활성 이유를 툴팁으로 알린다
function PendingAddButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-disabled="true"
          className="text-(--text-3) aria-disabled:opacity-60"
          onClick={(e) => e.preventDefault()}
        >
          <Plus size={14} strokeWidth={1.8} aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{PENDING_HINT}</TooltipContent>
    </Tooltip>
  );
}

// 아직 동작하지 않는 메뉴 항목. 항목 안에 "준비 중"을 보이고 마우스를 올리면 이유를 툴팁으로 알린다.
// 키보드 포커스로 툴팁을 열면 Esc가 툴팁만 닫고 메뉴가 남으므로 포커스로는 열지 않는다
export function PendingMenuItem({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild onFocus={(e) => e.preventDefault()}>
        <DropdownMenuItem aria-disabled="true" onSelect={(e) => e.preventDefault()} className="text-(--text-3)">
          {label}
          <span className="ml-auto text-(length:--fs-2xs) text-(--text-3)">준비 중</span>
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent side={side}>{PENDING_HINT}</TooltipContent>
    </Tooltip>
  );
}

const PROJECT_SUBVIEWS = ["board", "list", "timeline", "files"] as const;

function ProjectItem({
  ws,
  project,
  defaultOpen,
  onNavigate,
}: {
  ws: string;
  project: ShellProject;
  defaultOpen: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);
  const subId = useId();
  const base = `/${ws}/projects/${project.key}`;
  const overview = `${base}/overview`;
  const inside = pathname === base || pathname.startsWith(base + "/");

  return (
    <li>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={subId}
          aria-label={`${project.name} 하위 메뉴`}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) outline-none hover:bg-(--surface-3) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <ChevronRight
            size={12}
            strokeWidth={1.8}
            aria-hidden
            className={cn("transition-transform duration-(--dur)", open && "rotate-90")}
          />
        </button>
        <Link
          href={overview}
          aria-current={pathname === overview ? "page" : undefined}
          onClick={onNavigate}
          className={cn(rowClass, "flex-1 pl-1", inside && "text-(--text)")}
        >
          <ProjectIcon icon={project.icon} color={project.color} size={18} />
          <span className="truncate">{project.name}</span>
          {project.access === "private" && (
            <Lock size={12} strokeWidth={1.8} aria-label="비공개" role="img" className="shrink-0 text-(--text-3)" />
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {project.favorite && (
              <Star size={12} strokeWidth={1.8} aria-label="즐겨찾기" role="img" className="fill-(--amber) text-(--amber)" />
            )}
            <ProjectStatusDot status={project.status} />
          </span>
        </Link>
      </div>
      <ul id={subId} hidden={!open} className="mt-px space-y-px pl-7">
        {PROJECT_SUBVIEWS.map((tab) => {
          const href = `${base}/${tab}`;
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={onNavigate}
                className={cn(rowClass, "text-(length:--fs-sm)")}
              >
                {PROJECT_TAB_LABELS[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function Sidebar({
  data,
  inSheet = false,
  onNavigate,
}: {
  data: ShellData;
  inSheet?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { setPref } = usePrefs();
  const ws = data.workspace.slug;
  const p = (path: string) => `/${ws}/${path}`;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--bg-side)">
      <div className="flex h-(--topbar-h) shrink-0 items-center gap-1 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`워크스페이스 전환, 현재 ${data.workspace.name}`}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-(--r-sm) px-1.5 text-left outline-none hover:bg-(--surface-3) focus-visible:ring-2 focus-visible:ring-(--accent) aria-expanded:bg-(--surface-3)"
            >
              <WorkspaceTile name={data.workspace.name} color={data.workspace.color} />
              <span className="truncate text-(length:--fs-base) font-semibold text-(--text)">{data.workspace.name}</span>
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden className="shrink-0 text-(--text-3)" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-(length:--fs-2xs) text-(--text-3)">소속 워크스페이스</DropdownMenuLabel>
            {data.workspaces.map((w) => {
              const current = w.id === data.workspace.id;
              return (
                <DropdownMenuItem key={w.id} asChild>
                  <Link href={`/${w.slug}/home`} aria-current={current ? "page" : undefined} onClick={onNavigate}>
                    <WorkspaceTile name={w.name} color={w.color} />
                    <span className="truncate">{w.name}</span>
                    {current && (
                      <Check size={14} strokeWidth={1.8} aria-label="현재" role="img" className="ml-auto text-(--accent)" />
                    )}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {inSheet ? (
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="메뉴 닫기" className="text-(--text-3)">
              <X size={16} strokeWidth={1.8} aria-hidden />
            </Button>
          </SheetClose>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="사이드바 접기"
            className="text-(--text-3)"
            onClick={() => setPref("sidebarCollapsed", true)}
          >
            <PanelLeftClose size={16} strokeWidth={1.8} aria-hidden />
          </Button>
        )}
      </div>

      <nav aria-label="주 메뉴" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        <ul className="space-y-px">
          <NavItem href={p("home")} icon={House} label={NAV_LABELS.home} onNavigate={onNavigate} />
          <NavItem
            href={p("inbox")}
            icon={Inbox}
            label={NAV_LABELS.inbox}
            count={data.counts.unread}
            emphasis
            onNavigate={onNavigate}
          />
          <NavItem
            href={p("my-tasks")}
            icon={CircleCheckBig}
            label={NAV_LABELS.myTasks}
            count={data.counts.myOpenTasks}
            onNavigate={onNavigate}
          />
          <NavItem href={p("favorites")} icon={Star} label={NAV_LABELS.favorites} onNavigate={onNavigate} />
          <NavItem
            href={p("notifications")}
            icon={Bell}
            label={NAV_LABELS.notifications}
            count={data.counts.unread}
            onNavigate={onNavigate}
          />
        </ul>

        <section aria-label={NAV_LABELS.workspace}>
          <SectionTitle>{NAV_LABELS.workspace}</SectionTitle>
          <ul className="space-y-px">
            <NavItem href={p("overview")} icon={LayoutDashboard} label={NAV_LABELS.overview} onNavigate={onNavigate} />
            <NavItem href={p("projects")} icon={FolderKanban} label={NAV_LABELS.projects} onNavigate={onNavigate} />
            <NavItem href={p("tasks")} icon={ListChecks} label={NAV_LABELS.tasks} onNavigate={onNavigate} />
            <NavItem href={p("calendar")} icon={Calendar} label={NAV_LABELS.calendar} onNavigate={onNavigate} />
            <NavItem href={p("timeline")} icon={ChartGantt} label={NAV_LABELS.timeline} onNavigate={onNavigate} />
            <NavItem href={p("members")} icon={Users} label={NAV_LABELS.members} onNavigate={onNavigate} />
            <NavItem href={p("activity")} icon={Activity} label={NAV_LABELS.activity} onNavigate={onNavigate} />
          </ul>
        </section>

        <section aria-label={NAV_LABELS.projects}>
          <SectionTitle action={<PendingAddButton label={NAV_LABELS.newProject} />}>{NAV_LABELS.projects}</SectionTitle>
          {data.projects.length === 0 ? (
            <p className="px-2 text-(length:--fs-sm) text-(--text-3)">프로젝트가 아직 없습니다.</p>
          ) : (
            <ul className="space-y-px">
              {data.projects.map((project) => (
                <ProjectItem
                  key={project.id}
                  ws={ws}
                  project={project}
                  defaultOpen={pathname.startsWith(`/${ws}/projects/${project.key}/`)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          )}
          <ul className="mt-px space-y-px">
            <NavItem href={p("archive")} icon={Archive} label={NAV_LABELS.archive} onNavigate={onNavigate} />
          </ul>
        </section>

        <section aria-label={NAV_LABELS.teams}>
          <SectionTitle action={<PendingAddButton label={NAV_LABELS.newTeam} />}>
            <Link
              href={p("teams")}
              aria-current={pathname === p("teams") ? "page" : undefined}
              onClick={onNavigate}
              className="rounded-(--r-xs) outline-none hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent) aria-[current=page]:text-(--text)"
            >
              {NAV_LABELS.teams}
            </Link>
          </SectionTitle>
          <ul className="space-y-px">
            {data.teams.map((team) => {
              const href = p(`teams/${team.id}`);
              return (
                <li key={team.id}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    onClick={onNavigate}
                    className={rowClass}
                  >
                    <ProjectIcon icon={team.icon} color={team.color} size={18} />
                    <span className="truncate">{team.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </nav>

      <div className="shrink-0 space-y-px border-t border-(--border) px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(rowClass, "w-full aria-expanded:bg-(--surface-3)")}>
              <LifeBuoy {...iconProps} className="shrink-0 text-(--text-3)" />
              <span className="truncate">{NAV_LABELS.help}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <PendingMenuItem label="키보드 단축키" side="right" />
            {isDev && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-(length:--fs-2xs) text-(--text-3)">개발 전용</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={p("help/system")} onClick={onNavigate}>
                    {NAV_LABELS.system}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={p("help/states")} onClick={onNavigate}>
                    {NAV_LABELS.states}
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ul>
          <NavItem href={p("settings/general")} icon={Settings} label={NAV_LABELS.settings} onNavigate={onNavigate} />
        </ul>
        <Link
          href={p("settings/profile")}
          aria-current={pathname === p("settings/profile") ? "page" : undefined}
          onClick={onNavigate}
          className={cn(rowClass, "mt-1 h-10")}
        >
          <MemberAvatar name={data.me.name} color={data.me.color} size={24} online />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-(length:--fs-sm) font-medium text-(--text)">{data.me.name}</span>
            <span className="block truncate text-(length:--fs-2xs) text-(--text-3)">{data.me.email}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

export function WorkspaceTile({ name, color }: { name: string; color: string }) {
  const hex = colorHex(color);
  return (
    <span
      aria-hidden
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-(--r-xs) text-(length:--fs-2xs) font-semibold text-(--text)"
      style={{ background: `color-mix(in srgb, ${hex} 28%, var(--surface))` }}
    >
      {name.trim()[0] ?? "?"}
    </span>
  );
}
