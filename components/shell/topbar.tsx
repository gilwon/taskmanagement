"use client";
// 탑바. 메뉴·사이드바 펼치기 버튼, 브레드크럼, 검색 이동, 테마 전환, 알림 벨, 새로 만들기, 아바타 메뉴(META §1)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Bell, ChevronDown, LogOut, Menu, Moon, PanelLeftOpen, Plus, Search, Settings, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { useCommand } from "@/components/command/command-provider";
import { useNewProject } from "@/components/projects/new-project-launcher";
import { useNewTask } from "@/components/tasks/new-task";
import { signOut } from "@/lib/auth/actions";
import type { ShellData } from "@/lib/data/workspace";
import { NAV_LABELS, PROJECT_TAB_LABELS, SETTINGS_SECTIONS } from "@/lib/i18n/labels";
import { isAdminRole } from "@/lib/org/rules";
import type { Prefs } from "@/lib/prefs/prefs";
import { usePrefs } from "@/lib/prefs/provider";

// 브레드크럼에 이름을 보일 URL 첫 세그먼트. 표시명은 NAV_LABELS 하나에서 가져온다
const SEGMENT_KEYS: Record<string, keyof typeof NAV_LABELS> = {
  home: "home",
  inbox: "inbox",
  "my-tasks": "myTasks",
  favorites: "favorites",
  notifications: "notifications",
  search: "search",
  overview: "overview",
  projects: "projects",
  tasks: "tasks",
  task: "tasks",
  calendar: "calendar",
  timeline: "timeline",
  members: "members",
  teams: "teams",
  activity: "activity",
  archive: "archive",
  settings: "settings",
  help: "help",
};

type Crumb = { label: string; href?: string };

// 경로 세그먼트와 셸 데이터로 브레드크럼을 만든다. 마지막 항목은 현재 위치라 링크가 없다
function buildCrumbs(pathname: string, data: ShellData): Crumb[] {
  const ws = data.workspace.slug;
  const [, , section, id, sub, subId] = pathname.split("/");
  const crumbs: Crumb[] = [{ label: data.workspace.name, href: `/${ws}/home` }];
  const sectionKey = section ? SEGMENT_KEYS[section] : undefined;
  if (!sectionKey) return crumbs;
  const sectionHref = section === "task" ? `/${ws}/tasks` : `/${ws}/${section}`;
  crumbs.push({ label: NAV_LABELS[sectionKey], href: sectionHref });

  const decoded = id ? decodeURIComponent(id) : undefined;
  if (section === "projects" && decoded) {
    const project = data.projects.find((p) => p.key === decoded);
    crumbs.push({ label: project?.name ?? decoded, href: `/${ws}/projects/${decoded}/overview` });
    if (sub === "views" && subId) crumbs.push({ label: "저장 뷰" });
    else if (sub && sub in PROJECT_TAB_LABELS) crumbs.push({ label: PROJECT_TAB_LABELS[sub as keyof typeof PROJECT_TAB_LABELS] });
  } else if (section === "teams" && decoded) {
    crumbs.push({ label: data.teams.find((t) => t.id === decoded)?.name ?? NAV_LABELS.teams });
  } else if (section === "settings" && decoded && decoded in SETTINGS_SECTIONS) {
    crumbs.push({ label: SETTINGS_SECTIONS[decoded as keyof typeof SETTINGS_SECTIONS].label });
  } else if (section === "help" && (decoded === "system" || decoded === "states")) {
    crumbs.push({ label: NAV_LABELS[decoded] });
  } else if (section === "task" && decoded) {
    crumbs.push({ label: decoded });
  } else if (section === "members" && decoded) {
    crumbs.push({ label: NAV_LABELS.profile });
  }
  const last = crumbs[crumbs.length - 1]!;
  delete last.href;
  return crumbs;
}

const iconBtn = "text-(--text-2) hover:text-(--text)";

const THEME_OPTIONS: { value: Prefs["theme"]; label: string }[] = [
  { value: "light", label: "밝게" },
  { value: "dark", label: "어둡게" },
  { value: "system", label: "시스템 설정" },
];

export function Topbar({ data, menuOpen, onOpenMenu }: { data: ShellData; menuOpen: boolean; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { prefs, setPref } = usePrefs();
  const [signingOut, startSignOut] = useTransition();
  const { openNewTask } = useNewTask();
  const { openNewProject } = useNewProject();
  const { openPalette, openInvite, toggleTheme } = useCommand();
  const ws = data.workspace.slug;
  const crumbs = buildCrumbs(pathname, data);

  return (
    <header className="flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-(--border) bg-(--bg) px-3 max-[901px]:px-(--gutter)">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        // 시트는 닫히면 DOM에서 빠지므로 열렸을 때만 가리킨다
        aria-controls={menuOpen ? "app-menu" : undefined}
        className={`only-narrow ${iconBtn}`}
        onClick={onOpenMenu}
      >
        <Menu size={18} strokeWidth={1.8} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="사이드바 펼치기"
        className={`only-collapsed ${iconBtn}`}
        onClick={() => setPref("sidebarCollapsed", false)}
      >
        <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden />
      </Button>

      <nav aria-label="현재 위치" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-(length:--fs-base)">
          {crumbs.map((c, i) => (
            <li
              key={i}
              // 좁은 화면에서는 마지막 두 단계만 보인다
              className={`flex min-w-0 items-center gap-1 ${i < crumbs.length - 2 ? "hide-m" : ""}`}
            >
              {i > 0 && (
                <span aria-hidden className={`text-(--text-4) ${i === crumbs.length - 2 ? "hide-m" : ""}`}>
                  /
                </span>
              )}
              {c.href ? (
                <Link
                  href={c.href}
                  className="-my-0.5 truncate rounded-(--r-xs) py-0.5 text-(--text-3) outline-none hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium text-(--text)">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        aria-label="검색하거나 이동"
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
        onClick={() => openPalette()}
        className="flex h-(--h-md) w-64 shrink-0 items-center gap-2 rounded-(--r-sm) border border-(--border) bg-(--surface) px-2.5 text-(length:--fs-sm) text-(--text-3) outline-none hover:border-(--border-strong) hover:text-(--text-2) focus-visible:ring-2 focus-visible:ring-(--accent) max-[1100px]:w-(--h-md) max-[1100px]:justify-center max-[1100px]:px-0"
      >
        <Search size={14} strokeWidth={1.8} aria-hidden className="shrink-0" />
        <span className="truncate max-[1100px]:hidden">검색하거나 이동…</span>
        <kbd className="ml-auto font-mono text-(length:--fs-2xs) text-(--text-3) max-[1100px]:hidden">⌘K</kbd>
      </button>

      {/* 밝게·어둡게를 한 번에 바꾼다. ⌘⇧L과 같은 동작이고 아이콘은 dark 변형으로 골라 서버 렌더와 어긋나지 않는다 */}
      <button
        type="button"
        aria-label="밝게·어둡게 전환"
        aria-keyshortcuts="Meta+Shift+L Control+Shift+L"
        title="밝게·어둡게 전환 (⌘⇧L)"
        onClick={toggleTheme}
        className="inline-flex size-(--h-md) shrink-0 items-center justify-center rounded-(--r-sm) text-(--text-2) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        <Moon size={16} strokeWidth={1.8} aria-hidden className="dark:hidden" />
        <Sun size={16} strokeWidth={1.8} aria-hidden className="hidden dark:block" />
      </button>

      <Link
        href={`/${ws}/notifications`}
        aria-label={data.counts.unread ? `알림, 안 읽은 알림 ${data.counts.unread}개` : "알림"}
        className="relative inline-flex size-(--h-md) shrink-0 items-center justify-center rounded-(--r-sm) text-(--text-2) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        <Bell size={16} strokeWidth={1.8} aria-hidden />
        {!!data.counts.unread && (
          <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-(--red) ring-2 ring-(--bg)" />
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-(--h-md) shrink-0 gap-1 px-2 text-(length:--fs-sm)" aria-label="새로 만들기">
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            <span className="hide-m">새로 만들기</span>
            <ChevronDown size={12} strokeWidth={1.8} aria-hidden className="hide-m" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => openNewTask()}>{NAV_LABELS.newTask}</DropdownMenuItem>
          {data.me.role !== null && data.me.role !== "guest" && (
            <DropdownMenuItem onSelect={openNewProject}>{NAV_LABELS.newProject}</DropdownMenuItem>
          )}
          {isAdminRole(data.me.role) && <DropdownMenuItem onSelect={openInvite}>{NAV_LABELS.inviteMember}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="계정 메뉴"
            className="inline-flex size-(--h-md) shrink-0 items-center justify-center rounded-full outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <MemberAvatar name={data.me.name} color={data.me.color} size={26} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-(length:--fs-sm) font-medium text-(--text)">{data.me.name}</span>
            <span className="block truncate text-(length:--fs-2xs) text-(--text-3)">{data.me.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/${ws}/settings/profile`}>
              <User size={14} strokeWidth={1.8} aria-hidden />
              {NAV_LABELS.profile}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${ws}/settings/general`}>
              <Settings size={14} strokeWidth={1.8} aria-hidden />
              {NAV_LABELS.settings}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-(length:--fs-2xs) text-(--text-3)">테마</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.theme} onValueChange={(v) => setPref("theme", v as Prefs["theme"])}>
            {THEME_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
            <LogOut size={14} strokeWidth={1.8} aria-hidden />
            {NAV_LABELS.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
