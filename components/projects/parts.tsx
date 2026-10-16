"use client";
// 프로젝트 화면 공용 부품. 진행 막대, 구성원 아바타 묶음, 프로젝트 ⋯ 메뉴·우클릭 메뉴(즐겨찾기·보관·삭제와 실행 취소 토스트)
import { Archive, ArchiveRestore, Ellipsis, Star, StarOff, Trash } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { announce } from "@/components/tasks/views/shared";
import { useT } from "@/lib/i18n/client";
import { deleteProject, restoreTrashItem, setProjectArchived, setProjectFavorite } from "@/lib/projects/actions";
import { cn } from "@/lib/utils";

export const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;
export const MENU_CLASS = "min-w-44 rounded-(--r) bg-(--surface) text-(--text) shadow-(--shadow-pop) ring-0";
export const TOOLBAR_BTN = "h-(--h-sm) gap-1.5 px-2 text-(length:--fs-sm) font-normal text-(--text-2) hover:text-(--text)";
export const SEARCH_INPUT =
  "h-(--h-sm) w-48 rounded-(--r-sm) border border-(--border) bg-(--surface) pr-2 pl-7 text-(length:--fs-sm) text-(--text) placeholder:text-(--text-4) focus-visible:border-(--accent-line) focus-visible:outline-none max-sm:w-36 [&::-webkit-search-cancel-button]:hidden";
export const LINK_CLS =
  "rounded-(--r-xs) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)";

export function ProgressBar({ pct, label, className }: { pct: number; label: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-(--r-full) bg-(--surface-3)"
      >
        <span
          className="block h-full origin-left animate-[growX_.52s_var(--ease)_both] rounded-(--r-full) bg-(--accent)"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-(length:--fs-xs) text-(--text-3) tabular-nums">{pct}%</span>
    </span>
  );
}

export function MemberStack({
  members,
  max = 3,
  size = 22,
}: {
  members: { id: string; name: string; color: string }[];
  max?: number;
  size?: number;
}) {
  const t = useT();
  if (members.length === 0) return <span className="text-(--text-4)">—</span>;
  const rest = members.length - max;
  return (
    <span role="img" aria-label={t("projects.menu.members", { names: members.map((m) => m.name).join(", ") })} className="flex items-center">
      {members.slice(0, max).map((m) => (
        <MemberAvatar key={m.id} name={m.name} color={m.color} size={size} className="-ml-1.5 ring-2 ring-(--surface) first:ml-0" />
      ))}
      {rest > 0 && (
        <span className="ml-1 text-(length:--fs-2xs) text-(--text-3)" aria-hidden>
          +{rest}
        </span>
      )}
    </span>
  );
}

type MenuProject = { id: string; key: string; name: string; favorite: boolean; archivedAt: string | null; canManage: boolean };

// 프로젝트 메뉴 항목. ⋯ 메뉴와 우클릭 메뉴가 같은 항목을 쓴다. 보관·삭제는 관리 권한자에게만 보인다(DB도 거부한다).
// 삭제는 소프트 삭제이고 토스트 "실행 취소"가 받은 토큰을 그대로 넘겨 그 프로젝트만 복원한다
type MenuAction = { key: string; label: string; icon: React.ReactNode; onSelect: () => void; destructive?: boolean };

function useProjectActions(project: MenuProject, workspaceId: string) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    announce(done);
  };

  const remove = async () => {
    setBusy(true);
    const r = await deleteProject(project.id);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    const { token } = r.data;
    toast(t("projects.menu.deleted", { name: project.name }), {
      description: t("projects.menu.deletedHint"),
      action: {
        label: t("projects.menu.undo"),
        onClick: async () => {
          const back = await restoreTrashItem("project", project.id, token);
          if (back.ok) toast.success(t("projects.menu.restored", { name: project.name }));
          else toast.error(back.error);
        },
      },
    });
  };

  const actions: MenuAction[] = [
    {
      key: "favorite",
      label: project.favorite ? t("projects.menu.removeFavorite") : t("projects.menu.addFavorite"),
      icon: project.favorite ? <StarOff {...ICON} /> : <Star {...ICON} />,
      onSelect: () =>
        void act(
          () => setProjectFavorite(workspaceId, project.id, !project.favorite),
          project.favorite ? t("projects.menu.favoriteRemoved") : t("projects.menu.favoriteAdded"),
        ),
    },
  ];
  if (project.canManage) {
    const archived = project.archivedAt !== null;
    actions.push(
      {
        key: "archive",
        label: archived ? t("projects.menu.unarchive") : t("projects.menu.archive"),
        icon: archived ? <ArchiveRestore {...ICON} /> : <Archive {...ICON} />,
        onSelect: () =>
          void act(
            () => setProjectArchived(project.id, !archived),
            archived ? t("projects.menu.unarchived", { name: project.name }) : t("projects.menu.archived", { name: project.name }),
          ),
      },
      { key: "delete", label: t("projects.menu.delete"), icon: <Trash {...ICON} />, onSelect: () => void remove(), destructive: true },
    );
  }
  return { busy, actions };
}

export function ProjectMenu({ project, workspaceId }: { project: MenuProject; workspaceId: string }) {
  const t = useT();
  const { busy, actions } = useProjectActions(project, workspaceId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={t("projects.menu.actions", { name: project.name })} disabled={busy}>
          <Ellipsis {...ICON} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CLASS}>
        {actions.map((a) => (
          <Fragment key={a.key}>
            {a.destructive && <DropdownMenuSeparator />}
            <DropdownMenuItem variant={a.destructive ? "destructive" : "default"} onSelect={a.onSelect}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 키보드로 연 메뉴는 포인터 좌표가 없으므로 요소 왼쪽 아래에 띄운다(task-context-menu와 같은 방식)
function openFromKeyboard(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 16, clientY: r.bottom - 4 }),
  );
}

// 프로젝트 행·카드 우클릭 메뉴. ⋯ 메뉴와 같은 항목이고 Shift+F10·메뉴 키로도 연다
export function ProjectContextMenu({
  project,
  workspaceId,
  children,
}: {
  project: MenuProject;
  workspaceId: string;
  children: React.ReactElement;
}) {
  const t = useT();
  const { actions } = useProjectActions(project, workspaceId);
  // 키보드로 연 경우 닫을 때 포커스를 돌려줄 요소
  const keyboardOpener = useRef<HTMLElement | null>(null);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onKeyDown={(e) => {
          const el = e.currentTarget as HTMLElement;
          // 메뉴는 포털이라 React 트리로는 이 요소 안이어도 DOM으로는 밖이다. 그 안의 키는 받지 않는다
          if (!el.contains(e.target as Node)) return;
          if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") {
            e.preventDefault();
            keyboardOpener.current = e.target as HTMLElement;
            openFromKeyboard(el);
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className={MENU_CLASS}
        aria-label={t("projects.menu.label", { name: project.name })}
        onCloseAutoFocus={(e) => {
          const el = keyboardOpener.current;
          keyboardOpener.current = null;
          if (!el?.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
      >
        {actions.map((a) => (
          <Fragment key={a.key}>
            {a.destructive && <ContextMenuSeparator />}
            <ContextMenuItem variant={a.destructive ? "destructive" : "default"} onSelect={a.onSelect}>
              {a.icon}
              {a.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
