"use client";
// 탑바. 메뉴·사이드바 펼치기 버튼, 브레드크럼, 검색 이동, 테마 전환, 알림 벨, 새로 만들기, 아바타 메뉴(META §1)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, LogOut, Menu, Moon, PanelLeftOpen, Plus, Settings, Sun, User } from "lucide-react";
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
import { TopbarBell } from "@/components/shell/topbar-bell";
import { TopbarSearch } from "@/components/shell/topbar-search";
import { useCommand } from "@/components/command/command-provider";
import { useNewProject } from "@/components/projects/new-project-launcher";
import { useNewTask } from "@/components/tasks/new-task";
import { signOut } from "@/lib/auth/actions";
import type { ShellData } from "@/lib/data/workspace";
import { useT } from "@/lib/i18n/client";
import { NAV_LABELS, PROJECT_TAB_LABELS, SETTINGS_SECTIONS } from "@/lib/i18n/labels";
import type { T } from "@/lib/i18n/t";
import { isAdminRole } from "@/lib/org/rules";
import type { Prefs } from "@/lib/prefs/prefs";
import { usePrefs } from "@/lib/prefs/provider";

// 브레드크럼에 이름을 보일 URL 첫 세그먼트. 표시명은 사전 common.nav(NAV_LABELS와 같은 키)에서 가져온다
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
  inventory: "inventory",
  members: "members",
  teams: "teams",
  activity: "activity",
  archive: "archive",
  settings: "settings",
  help: "help",
};

type Crumb = { label: string; href?: string };

// 경로 세그먼트와 셸 데이터로 브레드크럼을 만든다. 마지막 항목은 현재 위치라 링크가 없다
function buildCrumbs(pathname: string, data: ShellData, t: T): Crumb[] {
  const ws = data.workspace.slug;
  const [, , section, id, sub, subId] = pathname.split("/");
  const crumbs: Crumb[] = [{ label: data.workspace.name, href: `/${ws}/home` }];
  const sectionKey = section ? SEGMENT_KEYS[section] : undefined;
  if (!sectionKey) return crumbs;
  const sectionHref = section === "task" ? `/${ws}/tasks` : `/${ws}/${section}`;
  crumbs.push({ label: t(`common.nav.${sectionKey}`), href: sectionHref });

  const decoded = id ? decodeURIComponent(id) : undefined;
  if (section === "projects" && decoded) {
    const project = data.projects.find((p) => p.key === decoded);
    crumbs.push({ label: project?.name ?? decoded, href: `/${ws}/projects/${decoded}/overview` });
    if (sub === "views" && subId) crumbs.push({ label: t("shell.savedView") });
    else if (sub && sub in PROJECT_TAB_LABELS) crumbs.push({ label: t(`common.projectTab.${sub as keyof typeof PROJECT_TAB_LABELS}`) });
  } else if (section === "teams" && decoded) {
    crumbs.push({ label: data.teams.find((t) => t.id === decoded)?.name ?? t("common.nav.teams") });
  } else if (section === "settings" && decoded && decoded in SETTINGS_SECTIONS) {
    crumbs.push({ label: t(`org.settings.section.${decoded as keyof typeof SETTINGS_SECTIONS}`) });
  } else if (section === "help" && (decoded === "system" || decoded === "states")) {
    crumbs.push({ label: t(`common.nav.${decoded}`) });
  } else if (section === "task" && decoded) {
    crumbs.push({ label: decoded });
  } else if (section === "members" && decoded) {
    crumbs.push({ label: t("common.nav.profile") });
  }
  const last = crumbs[crumbs.length - 1]!;
  delete last.href;
  return crumbs;
}

const iconBtn = "text-(--text-2) hover:text-(--text)";

// 표시명은 사전 shell.themeOption에서 가져온다
const THEME_OPTIONS: Prefs["theme"][] = ["light", "dark", "system"];

export function Topbar({ data, menuOpen, onOpenMenu }: { data: ShellData; menuOpen: boolean; onOpenMenu: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const { prefs, setPref } = usePrefs();
  const [signingOut, startSignOut] = useTransition();
  const { openNewTask } = useNewTask();
  const { openNewProject } = useNewProject();
  const { openInvite, toggleTheme } = useCommand();
  const [searchOpen, setSearchOpen] = useState(false);
  const ws = data.workspace.slug;
  const crumbs = buildCrumbs(pathname, data, t);

  return (
    <header className={`u027-host ${searchOpen ? "is-open" : ""} flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-(--border) bg-(--bg) px-3 max-[901px]:px-(--gutter)`}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("shell.openMenu")}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        // 시트는 닫히면 DOM에서 빠지므로 열렸을 때만 가리킨다
        aria-controls={menuOpen ? "app-menu" : undefined}
        className={`u027-aside only-narrow ${iconBtn}`}
        onClick={onOpenMenu}
      >
        <Menu size={18} strokeWidth={1.8} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("shell.expandSidebar")}
        className={`u027-aside only-collapsed ${iconBtn}`}
        onClick={() => setPref("sidebarCollapsed", false)}
      >
        <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden />
      </Button>

      <nav aria-label={t("shell.breadcrumb")} className="u027-aside min-w-0 flex-1">
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

      <TopbarSearch workspace={data.workspace} open={searchOpen} onOpenChange={setSearchOpen} />

      {/* 밝게·어둡게를 한 번에 바꾼다. ⌘⇧L과 같은 동작이고 아이콘은 dark 변형으로 골라 서버 렌더와 어긋나지 않는다 */}
      <button
        type="button"
        aria-label={t("shell.toggleTheme")}
        aria-keyshortcuts="Meta+Shift+L Control+Shift+L"
        title={t("shell.toggleThemeTitle")}
        onClick={toggleTheme}
        className="u027-aside inline-flex size-(--h-md) shrink-0 items-center justify-center rounded-(--r-sm) text-(--text-2) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        <Moon size={16} strokeWidth={1.8} aria-hidden className="dark:hidden" />
        <Sun size={16} strokeWidth={1.8} aria-hidden className="hidden dark:block" />
      </button>

      <TopbarBell workspace={data.workspace} unread={data.counts.unread} className="u027-aside" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="u027-aside h-(--h-md) shrink-0 gap-1 px-2 text-(length:--fs-sm)" aria-label={t("shell.create")}>
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            <span className="hide-m">{t("shell.create")}</span>
            <ChevronDown size={12} strokeWidth={1.8} aria-hidden className="hide-m" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => openNewTask()}>{t("common.nav.newTask")}</DropdownMenuItem>
          {data.me.role !== null && data.me.role !== "guest" && (
            <DropdownMenuItem onSelect={openNewProject}>{t("common.nav.newProject")}</DropdownMenuItem>
          )}
          {isAdminRole(data.me.role) && <DropdownMenuItem onSelect={openInvite}>{t("common.nav.inviteMember")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("shell.accountMenu")}
            className="u027-aside inline-flex size-(--h-md) shrink-0 items-center justify-center rounded-full outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-(--accent)"
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
              {t("common.nav.profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${ws}/settings/general`}>
              <Settings size={14} strokeWidth={1.8} aria-hidden />
              {t("common.nav.settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-(length:--fs-2xs) text-(--text-3)">{t("shell.theme")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.theme} onValueChange={(v) => setPref("theme", v as Prefs["theme"])}>
            {THEME_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o} value={o}>
                {t(`shell.themeOption.${o}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
            <LogOut size={14} strokeWidth={1.8} aria-hidden />
            {t("common.nav.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
