"use client";
// 커맨드 팔레트 본문(META §6). 명령 모드는 제안·최근 작업·이동·프로젝트·명령을 cmdk로 거르고,
// 검색 모드는 범위(전체·작업·프로젝트·사람·파일·댓글)별 서버 검색 결과와 최근 검색·추천을 보인다.
// 입력은 combobox, 결과는 listbox + aria-activedescendant(cmdk). Tab으로 모드 전환, 빈 입력 Backspace로 명령 모드 복귀
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarClock,
  ChartGantt,
  CircleCheckBig,
  Clock,
  FileText,
  FolderKanban,
  FolderPlus,
  House,
  Inbox,
  Keyboard,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MessageSquare,
  Moon,
  PanelLeft,
  Palette,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { loadOverdueTasks, loadRecentTasks, type PaletteTask } from "@/components/command/actions";
import { Highlight } from "@/components/search/highlight";
import { searchHref } from "@/components/search/href";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon } from "@/components/shell/project-icon";
import { WorkspaceTile } from "@/components/shell/sidebar";
import { keyLabel } from "@/components/shortcuts/shortcut-list";
import { useIsMac } from "@/components/shortcuts/shortcuts-dialog";
import { StatusIcon } from "@/components/tasks/parts";
import type { ShellData } from "@/lib/data/workspace";
import { useT } from "@/lib/i18n/client";
import { getRecentSearches, saveRecentSearch, searchWorkspaceAction } from "@/lib/search/actions";
import { canOpenOrgScreens, isAdminRole } from "@/lib/org/rules";
import { normalizeQuery } from "@/lib/search/text";
import { SEARCH_SCOPES, type SearchResults, type SearchScope } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export type PaletteMode = "cmd" | "search";

// 팔레트가 실행하는 동작. 이동·대화상자 열기는 팔레트가 닫히고 포커스가 돌아간 뒤에 한다
export type PaletteCommands = {
  navigate: (href: string) => void;
  newTask: () => void;
  newProject: () => void;
  invite: () => void;
  toggleTheme: () => void;
  isDark: () => boolean;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
  shortcuts: () => void;
  signOut: () => void;
};

const SEARCH_DEBOUNCE = 200;
// 명령 모드에서 함께 보이는 작업 검색 결과 수, 검색 모드 범위별 결과 수
const CMD_TASK_LIMIT = 5;
const SEARCH_LIMIT = 5;

const icon = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;
const itemClass = "h-(--h-lg) gap-2.5 px-2.5 text-(length:--fs-base) text-(--text)";
const groupClass =
  "px-1.5 **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:text-(length:--fs-2xs) **:[[cmdk-group-heading]]:text-(--text-3)";

const kbd =
  "inline-flex h-(--h-xs) min-w-(--h-xs) items-center justify-center rounded-(--r-xs) border border-(--border) bg-(--surface-2) px-1 font-mono text-(length:--fs-2xs) text-(--text-3)";

// 단축키 표시. 화면 읽기 프로그램은 항목 이름만 읽게 숨긴다
function Keys({ keys }: { keys: string[] }) {
  const mac = useIsMac();
  return (
    <span aria-hidden className="ml-auto flex shrink-0 items-center gap-1" data-slot="command-shortcut">
      {keys.map((k, i) => (
        <kbd key={i} className={kbd}>
          {keyLabel(k, mac)}
        </kbd>
      ))}
    </span>
  );
}

function Item({
  value,
  onSelect,
  icon: Icon,
  children,
  keys,
  keywords,
}: {
  value: string;
  onSelect: () => void;
  icon?: LucideIcon;
  children: React.ReactNode;
  keys?: string[];
  keywords?: string[];
}) {
  return (
    <CommandItem value={value} keywords={keywords} onSelect={onSelect} className={itemClass}>
      {Icon && <Icon {...icon} className="text-(--text-3)" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {keys && <Keys keys={keys} />}
    </CommandItem>
  );
}

const EMPTY: SearchResults = { tasks: [], projects: [], people: [], files: [], comments: [] };

// 검색 모드 결과 목록의 첫 항목 value. 아래 CommandItem value와 같은 형식이다
function firstValue(r: SearchResults): string {
  if (r.tasks[0]) return `task:${r.tasks[0].id}`;
  if (r.projects[0]) return `project:${r.projects[0].id}`;
  if (r.people[0]) return `person:${r.people[0].id}`;
  if (r.files[0]) return `file:${r.files[0].id}`;
  if (r.comments[0]) return `comment:${r.comments[0].id}`;
  return "view-all";
}

export function CommandPalette({
  open,
  onOpenChange,
  mode,
  onModeChange,
  data,
  commands,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PaletteMode;
  onModeChange: (mode: PaletteMode) => void;
  data: ShellData;
  commands: PaletteCommands;
  onCloseAutoFocus: (e: Event) => void;
}) {
  const t = useT();
  const ws = data.workspace.slug;
  // 게스트는 프로젝트를 만들 수 없다
  const canCreateProject = data.me.role !== null && data.me.role !== "guest";
  // 게스트는 구성원 화면이 403이라 구성원 이동과 사람 검색 결과를 보이지 않는다
  const showOrgLinks = canOpenOrgScreens(data.me.role);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<"root" | "workspaces" | "overdue">("root");
  // 기한 지난 작업. null이면 읽는 중
  const [overdue, setOverdue] = useState<PaletteTask[] | null>(null);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [scope, setScope] = useState<SearchScope>("all");
  const [recentTasks, setRecentTasks] = useState<PaletteTask[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  // 검색 모드의 선택 항목. 결과가 늦게 오면 cmdk가 먼저 있던 "모든 결과 보기"에 머무르므로 첫 결과로 옮긴다
  const [selected, setSelected] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열 때마다 입력·페이지를 비우고 최근 작업·최근 검색을 새로 읽는다
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setPage("root");
      setScope("all");
      setResults(EMPTY);
      setSearchError(null);
    }
  }
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadRecentTasks(data.workspace.id).then((r) => alive && r.ok && setRecentTasks(r.data));
    void getRecentSearches(data.workspace.id).then((r) => alive && r.ok && setRecentSearches(r.data));
    return () => {
      alive = false;
    };
  }, [open, data.workspace.id]);

  // 서버 검색. 명령 모드는 작업만, 검색 모드는 고른 범위. 늦게 온 이전 응답은 버린다
  const q = normalizeQuery(query);
  const searchScope: SearchScope = mode === "search" ? scope : "tasks";
  const wantSearch = open && page === "root" && q !== "";
  useEffect(() => {
    if (!wantSearch) return;
    let alive = true;
    const timer = setTimeout(() => {
      setSearching(true);
      const limit = mode === "search" ? SEARCH_LIMIT : CMD_TASK_LIMIT;
      void searchWorkspaceAction(data.workspace.id, q, searchScope, limit).then((r) => {
        if (!alive) return;
        setSearching(false);
        if (r.ok) {
          const found = showOrgLinks ? r.data : { ...r.data, people: [] };
          setResults(found);
          if (mode === "search") setSelected(firstValue(found));
          setSearchError(null);
        } else {
          setResults(EMPTY);
          setSearchError(r.error);
        }
      });
    }, SEARCH_DEBOUNCE);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [wantSearch, q, searchScope, mode, data.workspace.id, showOrgLinks]);
  const shown = wantSearch ? results : EMPTY;
  const busy = wantSearch && searching;

  const go = (href: string) => commands.navigate(href);
  // 검색 결과로 이동하면 그 검색어를 최근 검색에 남긴다
  const goFromSearch = (href: string) => {
    if (q) void saveRecentSearch(data.workspace.id, q);
    go(href);
  };
  const setModeKeep = (next: PaletteMode) => {
    onModeChange(next);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const nav = useMemo(
    () =>
      [
        { path: "home", label: t("common.nav.home"), icon: House, keys: ["G", "H"] },
        { path: "inbox", label: t("common.nav.inbox"), icon: Inbox, keys: ["G", "I"] },
        { path: "my-tasks", label: t("common.nav.myTasks"), icon: CircleCheckBig, keys: ["G", "T"] },
        { path: "projects", label: t("common.nav.projects"), icon: FolderKanban, keys: ["G", "P"] },
        { path: "calendar", label: t("common.nav.calendar"), icon: Calendar, keys: ["G", "C"] },
        { path: "timeline", label: t("common.nav.timeline"), icon: ChartGantt },
        { path: "members", label: t("common.nav.members"), icon: Users, keys: ["G", "M"] },
        { path: "tasks", label: t("common.nav.tasks"), icon: ListChecks },
        { path: "overview", label: t("common.nav.overview"), icon: LayoutDashboard },
        { path: "notifications", label: t("common.nav.notifications"), icon: Bell, keys: ["G", "N"] },
        { path: "activity", label: t("common.nav.activity"), icon: Activity, keys: ["G", "A"] },
        { path: "favorites", label: t("common.nav.favorites"), icon: Star },
        { path: "archive", label: t("common.nav.archive"), icon: Archive },
      ] satisfies { path: string; label: string; icon: LucideIcon; keys?: string[] }[],
    [t],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Tab" && !e.shiftKey && e.target === inputRef.current) {
      e.preventDefault();
      if (page !== "root") setPage("root");
      setModeKeep(mode === "cmd" ? "search" : "cmd");
    } else if (e.key === "Backspace" && query === "" && e.target === inputRef.current) {
      if (page !== "root") {
        e.preventDefault();
        setPage("root");
      } else if (mode === "search") {
        e.preventDefault();
        setModeKeep("cmd");
      }
    }
  };

  const dark = open && commands.isDark();
  const hasResults = Object.values(shown).some((list) => list.length > 0);
  const placeholder =
    page === "workspaces"
      ? t("command.placeholder.workspaces")
      : page === "overdue"
        ? t("command.placeholder.overdue")
        : mode === "search"
          ? t("command.placeholder.search")
          : t("command.placeholder.command");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        aria-describedby="command-palette-desc"
        className="u046-pal top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[640px] max-[640px]:top-2 max-[640px]:max-w-[calc(100%-1rem)]"
      >
        <DialogTitle className="sr-only">{t("command.title")}</DialogTitle>
        <DialogDescription id="command-palette-desc" className="sr-only">
          {t("command.description")}
        </DialogDescription>
        <CommandPrimitive
          label={t("command.title")}
          loop
          // 검색 모드와 작업 결과는 서버가 이미 걸렀다. 명령 모드의 고정 항목만 cmdk가 거른다
          shouldFilter={mode === "cmd" || page !== "root"}
          {...(mode === "search" && page === "root" && { value: selected, onValueChange: setSelected })}
          onKeyDown={onKeyDown}
          className="flex flex-col bg-(--surface) text-(--text)"
        >
          <div className="flex items-center gap-2 border-b border-(--border) px-3">
            {mode === "search" || page !== "root" ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={t("command.backToCommands")}
                onClick={() => {
                  setPage("root");
                  setModeKeep("cmd");
                }}
                className="inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) hover:bg-(--surface-2) hover:text-(--text)"
              >
                <ArrowLeft {...icon} />
              </button>
            ) : (
              <Search {...icon} className="shrink-0 text-(--text-3)" />
            )}
            <CommandPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              aria-label={placeholder}
              maxLength={200}
              className="h-12 min-w-0 flex-1 bg-transparent text-(length:--fs-md) text-(--text) outline-none placeholder:text-(--text-4)"
            />
            <kbd className={cn(kbd, "shrink-0")}>Esc</kbd>
          </div>

          {mode === "search" && page === "root" && (
            <div role="group" aria-label={t("command.searchScope")} className="flex flex-wrap gap-1 border-b border-(--border) px-3 py-2">
              {SEARCH_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => {
                    setScope(s);
                    inputRef.current?.focus();
                  }}
                  className="h-(--h-sm) rounded-(--r-sm) border border-(--border) px-2 text-(length:--fs-xs) text-(--text-2) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) aria-pressed:border-(--accent-line) aria-pressed:bg-(--accent-soft) aria-pressed:text-(--text)"
                >
                  {t(`common.searchTab.${s}`)}
                </button>
              ))}
            </div>
          )}

          <CommandList className="max-h-[min(420px,60dvh)] py-1.5" aria-busy={busy || undefined}>
            {page === "overdue" ? (
              <>
                {overdueError ? (
                  <p role="alert" className="px-4 py-6 text-center text-(length:--fs-sm) text-(--red)">
                    {overdueError}
                  </p>
                ) : overdue === null ? (
                  <p className="px-4 py-6 text-center text-(length:--fs-sm) text-(--text-3)">{t("command.searching")}</p>
                ) : (
                  <CommandEmpty className="py-6 text-(length:--fs-sm) text-(--text-3)">{t("command.noOverdue")}</CommandEmpty>
                )}
                {overdue && overdue.length > 0 && (
                  <CommandGroup heading={t("command.overdue")} className={groupClass}>
                    {overdue.map((t) => (
                      <CommandItem
                        key={t.key}
                        value={`${t.key} ${t.title}`}
                        onSelect={() => go(`/${ws}/task/${t.key}`)}
                        className={itemClass}
                      >
                        <StatusIcon status={t.status} size={14} />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{t.key}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            ) : page === "workspaces" ? (
              <>
                <CommandEmpty className="py-6 text-(length:--fs-sm) text-(--text-3)">{t("command.noWorkspaces")}</CommandEmpty>
                <CommandGroup heading={t("command.switchWorkspace")} className={groupClass}>
                  {data.workspaces.map((w) => (
                    <CommandItem
                      key={w.id}
                      value={`${w.name} ${w.slug}`}
                      onSelect={() => go(`/${w.slug}/home`)}
                      className={itemClass}
                    >
                      <WorkspaceTile name={w.name} color={w.color} />
                      <span className="min-w-0 flex-1 truncate">{w.name}</span>
                      {w.id === data.workspace.id && <span className="text-(length:--fs-2xs) text-(--text-3)">{t("command.current")}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : mode === "cmd" ? (
              <>
                <CommandEmpty className="py-6 text-(length:--fs-sm) text-(--text-3)">
                  {busy ? t("command.searching") : t("command.noCommands")}
                </CommandEmpty>
                <CommandGroup heading={t("command.group.suggestions")} className={groupClass}>
                  <Item value={t("command.newTask")} icon={Plus} keys={["N"]} onSelect={commands.newTask}>
                    {t("command.newTask")}
                  </Item>
                  {canCreateProject && (
                    <Item value={t("command.newProject")} icon={FolderPlus} keys={["P"]} onSelect={commands.newProject}>
                      {t("command.newProject")}
                    </Item>
                  )}
                  <Item value={t("command.searchWorkspace")} icon={Search} keys={["/"]} onSelect={() => setModeKeep("search")}>
                    {t("command.searchWorkspace")}
                  </Item>
                  <Item
                    value={t("command.switchWorkspace")}
                    icon={FolderKanban}
                    onSelect={() => {
                      setQuery("");
                      setPage("workspaces");
                    }}
                  >
                    {t("command.switchWorkspaceMore")}
                  </Item>
                  <Item
                    value={dark ? t("command.toLight") : t("command.toDark")}
                    keywords={t("command.themeKeywords").split(" ")}
                    icon={dark ? Sun : Moon}
                    keys={["Mod", "Shift", "L"]}
                    onSelect={commands.toggleTheme}
                  >
                    {dark ? t("command.toLight") : t("command.toDark")}
                  </Item>
                </CommandGroup>

                {q === "" && recentTasks.length > 0 && (
                  <CommandGroup heading={t("command.group.recentTasks")} className={groupClass}>
                    {recentTasks.map((t) => (
                      <CommandItem
                        key={t.key}
                        value={`recent ${t.key} ${t.title}`}
                        onSelect={() => go(`/${ws}/task/${t.key}`)}
                        className={itemClass}
                      >
                        <StatusIcon status={t.status} size={14} />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{t.key}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {shown.tasks.length > 0 && (
                  <CommandGroup heading={t("command.group.tasks")} className={groupClass}>
                    {shown.tasks.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.key} ${t.title}`}
                        onSelect={() => go(`/${ws}/task/${t.key}`)}
                        className={itemClass}
                      >
                        <StatusIcon status={t.status} size={14} />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={t.title} q={q} />
                        </span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">
                          <Highlight text={t.key} q={q} />
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandGroup heading={t("command.group.navigate")} className={groupClass}>
                  {nav.filter((n) => showOrgLinks || n.path !== "members").map((n) => (
                    <Item
                      key={n.path}
                      value={t("command.goTo", { name: n.label })}
                      keywords={[n.path]}
                      icon={n.icon}
                      keys={"keys" in n ? n.keys : undefined}
                      onSelect={() => go(`/${ws}/${n.path}`)}
                    >
                      {t("command.goTo", { name: n.label })}
                    </Item>
                  ))}
                </CommandGroup>

                {q !== "" && data.projects.length > 0 && (
                  <CommandGroup heading={t("common.nav.projects")} className={groupClass}>
                    {data.projects.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${t("command.projectPrefix")} ${p.name} ${p.key}`}
                        onSelect={() => go(`/${ws}/projects/${p.key}/overview`)}
                        className={itemClass}
                      >
                        <ProjectIcon icon={p.icon} color={p.color} size={18} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{p.key}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandGroup heading={t("command.group.commands")} className={groupClass}>
                  <Item value={t("command.openSettings")} icon={Settings} keys={["G", "S"]} onSelect={() => go(`/${ws}/settings/general`)}>
                    {t("command.openSettings")}
                  </Item>
                  <Item
                    value={t("command.appearance")}
                    keywords={t("command.appearanceKeywords").split(" ")}
                    icon={Palette}
                    onSelect={() => go(`/${ws}/settings/appearance`)}
                  >
                    {t("command.appearance")}
                  </Item>
                  {isAdminRole(data.me.role) && (
                    <Item value={t("common.nav.inviteMember")} icon={UserPlus} onSelect={commands.invite}>
                      {t("common.nav.inviteMember")}
                    </Item>
                  )}
                  <Item
                    value={commands.sidebarCollapsed ? t("command.expandSidebar") : t("command.collapseSidebar")}
                    icon={PanelLeft}
                    keys={["["]}
                    onSelect={commands.toggleSidebar}
                  >
                    {commands.sidebarCollapsed ? t("command.expandSidebar") : t("command.collapseSidebar")}
                  </Item>
                  <Item value={t("command.help")} icon={LifeBuoy} onSelect={() => go(`/${ws}/help`)}>
                    {t("command.help")}
                  </Item>
                  <Item value={t("command.shortcuts")} icon={Keyboard} keys={["?"]} onSelect={commands.shortcuts}>
                    {t("command.shortcuts")}
                  </Item>
                  <Item value={t("common.nav.signOut")} icon={LogOut} onSelect={commands.signOut}>
                    {t("common.nav.signOut")}
                  </Item>
                </CommandGroup>
              </>
            ) : q === "" ? (
              <>
                {recentSearches.length > 0 && (
                  <CommandGroup heading={t("command.group.recentSearches")} className={groupClass}>
                    {recentSearches.map((s) => (
                      <CommandItem key={s} value={`recent:${s}`} onSelect={() => setQuery(s)} className={itemClass}>
                        <Clock {...icon} className="text-(--text-3)" />
                        <span className="min-w-0 flex-1 truncate">{s}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup heading={t("command.group.recommended")} className={groupClass}>
                  <Item
                    value={t("command.overdue")}
                    icon={CalendarClock}
                    onSelect={() => {
                      setOverdue(null);
                      setOverdueError(null);
                      setPage("overdue");
                      void loadOverdueTasks(data.workspace.id).then((r) =>
                        r.ok ? setOverdue(r.data) : setOverdueError(r.error),
                      );
                    }}
                  >
                    {t("command.overdue")}
                  </Item>
                  <Item value={t("command.assignedToMe")} icon={CircleCheckBig} onSelect={() => go(`/${ws}/my-tasks`)}>
                    {t("command.assignedToMe")}
                  </Item>
                  <Item value={t("command.upcomingDeadlines")} icon={Calendar} onSelect={() => go(`/${ws}/calendar`)}>
                    {t("command.upcomingDeadlines")}
                  </Item>
                  <Item value={t("command.recentActivity")} icon={Activity} onSelect={() => go(`/${ws}/activity`)}>
                    {t("command.recentActivity")}
                  </Item>
                </CommandGroup>
              </>
            ) : (
              <>
                {searchError ? (
                  <p role="alert" className="px-4 py-6 text-center text-(length:--fs-sm) text-(--red)">
                    {searchError}
                  </p>
                ) : (
                  !hasResults && (
                    <p className="px-4 py-6 text-center text-(length:--fs-sm) text-(--text-3)">
                      {busy ? t("command.searching") : t("command.noMatch", { q })}
                    </p>
                  )
                )}
                {shown.tasks.length > 0 && (
                  <CommandGroup heading={t("common.searchTab.tasks")} className={groupClass}>
                    {shown.tasks.map((t) => (
                      <CommandItem key={t.id} value={`task:${t.id}`} onSelect={() => goFromSearch(`/${ws}/task/${t.key}`)} className={itemClass}>
                        <StatusIcon status={t.status} size={14} />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={t.title} q={q} />
                        </span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">
                          <Highlight text={t.key} q={q} />
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {shown.projects.length > 0 && (
                  <CommandGroup heading={t("common.searchTab.projects")} className={groupClass}>
                    {shown.projects.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`project:${p.id}`}
                        onSelect={() => goFromSearch(`/${ws}/projects/${p.key}/overview`)}
                        className={itemClass}
                      >
                        <ProjectIcon icon={p.icon} color={p.color} size={18} />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={p.name} q={q} />
                        </span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{p.key}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {shown.people.length > 0 && (
                  <CommandGroup heading={t("common.searchTab.people")} className={groupClass}>
                    {shown.people.map((m) => (
                      <CommandItem key={m.id} value={`person:${m.id}`} onSelect={() => goFromSearch(`/${ws}/members/${m.id}`)} className={itemClass}>
                        <MemberAvatar name={m.name} color={m.color} size={20} />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={m.name} q={q} />
                          <span className="ml-2 text-(length:--fs-xs) text-(--text-3)">
                            <Highlight text={m.email} q={q} />
                          </span>
                        </span>
                        <span className="shrink-0 text-(length:--fs-2xs) text-(--text-3)">{t(`common.role.${m.role}`)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {shown.files.length > 0 && (
                  <CommandGroup heading={t("common.searchTab.files")} className={groupClass}>
                    {shown.files.map((f) => (
                      <CommandItem
                        key={f.id}
                        value={`file:${f.id}`}
                        onSelect={() =>
                          goFromSearch(f.taskKey ? `/${ws}/task/${f.taskKey}` : `/${ws}/projects/${f.project.key}/files`)
                        }
                        className={itemClass}
                      >
                        <FileText {...icon} className="text-(--text-3)" />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={f.name} q={q} />
                        </span>
                        <span className="shrink-0 truncate text-(length:--fs-2xs) text-(--text-3)">
                          {t(`common.fileType.${f.type}`)} · {f.project.name}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {shown.comments.length > 0 && (
                  <CommandGroup heading={t("common.searchTab.comments")} className={groupClass}>
                    {shown.comments.map((c) => (
                      <CommandItem key={c.id} value={`comment:${c.id}`} onSelect={() => goFromSearch(`/${ws}/task/${c.taskKey}`)} className={itemClass}>
                        <MessageSquare {...icon} className="text-(--text-3)" />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={c.excerpt} q={q} />
                        </span>
                        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{c.taskKey}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandSeparator className="my-1 bg-(--border)" />
                <CommandGroup className={groupClass}>
                  <CommandItem value="view-all" onSelect={() => goFromSearch(searchHref(ws, q, scope))} className={itemClass}>
                    <Search {...icon} className="text-(--text-3)" />
                    <span className="min-w-0 flex-1 truncate">{t("command.viewAll", { q })}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          <div aria-hidden className="flex items-center gap-3 border-t border-(--border) px-3 py-2 text-(length:--fs-2xs) text-(--text-3)">
            <span>{t("command.footer.move")}</span>
            <span>{t("command.footer.select")}</span>
            <span>Tab {mode === "cmd" ? t("command.footer.searchMode") : t("command.footer.commandMode")}</span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
