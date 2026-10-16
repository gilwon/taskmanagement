"use client";
// 커맨드 팔레트·키보드 단축키 모달·구성원 초대의 열림 상태와 전역 단축키. 앱 셸 안에 한 번 두고 useCommand()로 연다.
// 셋 다 트리거 없이 열리므로 연 요소를 기억해 닫을 때 포커스를 돌려주고, 팔레트에서 고른 동작은 포커스가 돌아간 뒤 실행한다
import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, type PaletteCommands, type PaletteMode } from "@/components/command/command-palette";
import { useInviteDialog } from "@/components/org/invite-dialog";
import { useNewProject } from "@/components/projects/new-project-launcher";
import { ShortcutsDialog } from "@/components/shortcuts/shortcuts-dialog";
import { useGlobalShortcuts } from "@/components/shortcuts/use-global-shortcuts";
import { useNewTask } from "@/components/tasks/new-task";
import { signOut } from "@/lib/auth/actions";
import type { ShellData } from "@/lib/data/workspace";
import { canOpenOrgScreens } from "@/lib/org/rules";
import { usePrefs } from "@/lib/prefs/provider";

type Ctx = {
  openPalette: (mode?: PaletteMode) => void;
  openShortcuts: () => void;
  openInvite: () => void;
  toggleTheme: () => void;
};

const CommandContext = createContext<Ctx | null>(null);

export function useCommand() {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error("useCommand must be used inside CommandProvider");
  return ctx;
}

// 메뉴 항목에서 열었으면 메뉴가 닫히며 사라지므로 메뉴를 연 버튼을 돌려줄 곳으로 삼는다
function currentOpener(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest("[role=menu]")) {
    return document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]');
  }
  return active;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function CommandProvider({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const router = useRouter();
  const { prefs, setPref } = usePrefs();
  const { openNewTask } = useNewTask();
  const { openNewProject } = useNewProject();
  const invite = useInviteDialog(data.workspace.id);
  const setInviteOpen = invite.setOpen;
  const [, startSignOut] = useTransition();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("cmd");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const paletteOpenRef = useRef(false);
  const paletteOpener = useRef<HTMLElement | null>(null);
  const shortcutsOpener = useRef<HTMLElement | null>(null);
  // 팔레트가 닫히고 포커스가 돌아간 뒤 실행할 동작
  const afterClose = useRef<(() => void) | null>(null);

  const setPalette = useCallback((open: boolean) => {
    paletteOpenRef.current = open;
    setPaletteOpen(open);
  }, []);

  const openPalette = useCallback(
    (next: PaletteMode = "cmd") => {
      if (!paletteOpenRef.current) paletteOpener.current = currentOpener();
      setMode(next);
      setPalette(true);
    },
    [setPalette],
  );

  const openShortcuts = useCallback(() => {
    shortcutsOpener.current = currentOpener();
    setShortcutsOpen(true);
  }, []);

  const isDark = useCallback(
    () => prefs.theme === "dark" || (prefs.theme === "system" && matchMedia(DARK_QUERY).matches),
    [prefs.theme],
  );
  const toggleTheme = useCallback(() => setPref("theme", isDark() ? "light" : "dark"), [isDark, setPref]);
  const toggleSidebar = useCallback(
    () => setPref("sidebarCollapsed", !prefs.sidebarCollapsed),
    [prefs.sidebarCollapsed, setPref],
  );

  const ws = data.workspace.slug;
  useGlobalShortcuts({
    palette: () => (paletteOpenRef.current ? setPalette(false) : openPalette("cmd")),
    search: () => openPalette("search"),
    theme: toggleTheme,
    newTask: () => openNewTask(),
    // 게스트는 프로젝트를 만들 수 없으므로 P를 무시한다
    newProject: () => data.me.role !== null && data.me.role !== "guest" && openNewProject(),
    help: openShortcuts,
    sidebar: toggleSidebar,
    // 게스트는 구성원 화면이 403이라 G M을 무시한다
    go: (path) => (path !== "members" || canOpenOrgScreens(data.me.role)) && router.push(`/${ws}/${path}`),
  });

  // 팔레트를 닫고, 포커스가 돌아간 뒤(onCloseAutoFocus) fn을 실행한다
  const runLater = useCallback(
    (fn: () => void) => {
      afterClose.current = fn;
      setPalette(false);
    },
    [setPalette],
  );

  const commands: PaletteCommands = {
    navigate: (href) => runLater(() => router.push(href)),
    newTask: () => runLater(() => openNewTask()),
    newProject: () => runLater(openNewProject),
    invite: () => runLater(() => setInviteOpen(true)),
    toggleTheme: () => runLater(toggleTheme),
    isDark,
    toggleSidebar: () => runLater(toggleSidebar),
    sidebarCollapsed: prefs.sidebarCollapsed,
    shortcuts: () => runLater(openShortcuts),
    signOut: () => runLater(() => startSignOut(() => signOut())),
  };

  const ctx = useMemo<Ctx>(
    () => ({ openPalette, openShortcuts, openInvite: () => setInviteOpen(true), toggleTheme }),
    [openPalette, openShortcuts, setInviteOpen, toggleTheme],
  );

  return (
    <CommandContext.Provider value={ctx}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPalette}
        mode={mode}
        onModeChange={setMode}
        data={data}
        commands={commands}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          const el = paletteOpener.current;
          if (el?.isConnected) el.focus();
          const fn = afterClose.current;
          afterClose.current = null;
          fn?.();
        }}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        onCloseAutoFocus={(e) => {
          const el = shortcutsOpener.current;
          if (!el?.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
      />
      {invite.dialog}
    </CommandContext.Provider>
  );
}
