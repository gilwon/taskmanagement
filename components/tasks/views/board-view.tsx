"use client";
// 보드 뷰. 상태 5열(완료 숨김 반영), 열 헤더(아이콘·이름·개수·+·⋯), 작업 카드, 열 하단 인라인 컴포저, 카드 드래그
import { ChevronRight, MessageSquare, MoreHorizontal, Paperclip, Plus, Repeat } from "lucide-react";
import { Fragment, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssigneeAvatar, DueLabel, LabelChips, PriorityIcon, StatusIcon, TaskKey } from "@/components/tasks/parts";
import { useTaskActions } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { TaskContextMenu } from "@/components/tasks/views/task-context-menu";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { KeyContextMenu, type MenuItemComponent } from "@/components/shortcuts/key-context-menu";
import {
  AddTaskButton,
  DropLine,
  InlineComposer,
  isInnerControl,
  MOVE_HINT_ID,
  MoveHint,
  dropIndexMarks,
  type ViewCtl,
} from "@/components/tasks/views/shared";
import { useTaskDrag } from "@/components/tasks/views/use-drag";
import { useT } from "@/lib/i18n/client";
import type { TaskGroup, TaskItem, TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const iconBtn =
  "inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) outline-none hover:bg-(--surface-3) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)";

export function BoardView({ ctl, groups }: { ctl: ViewCtl; groups: TaskGroup[] }) {
  // t는 작업 변수로 쓰여 번역 함수는 tr로 둔다
  const tr = useT();
  const { dragId, target, onPointerDown } = useTaskDrag((id, t) => ctl.drop(id, t, groups, "status"));
  const { bulkUpdate, update } = useTaskActions();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [composing, setComposing] = useState<string | null>(null);
  // 편집 가능한 프로젝트가 없으면 빠른 추가를 숨긴다
  const canAdd = ctl.projects.length > 0;

  const setCollapse = (key: string, value: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <div data-drag-scroll className="overflow-x-auto pb-(--s-8)">
      <MoveHint board />
      <div className="flex w-max gap-(--s-3) px-(--gutter)">
        {groups.map((g) => {
          const status = g.key as TaskStatus;
          const headingId = `board-col-${g.key}`;
          if (collapsed.has(g.key)) {
            return (
              <section
                key={g.key}
                aria-labelledby={headingId}
                data-drop-group={g.key}
                className="flex w-10 shrink-0 flex-col items-center rounded-(--r-lg) bg-(--surface-2) py-2"
              >
                <button
                  type="button"
                  aria-expanded={false}
                  onClick={() => setCollapse(g.key, false)}
                  className="flex flex-col items-center gap-2 rounded-(--r-xs) px-1 py-1 outline-none hover:bg-(--surface-3) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  <ChevronRight aria-hidden size={14} strokeWidth={1.8} className="text-(--text-3)" />
                  <StatusIcon status={status} size={14} />
                  <h2 id={headingId} className="text-(length:--fs-sm) font-semibold [writing-mode:vertical-rl]">
                    {g.label}
                  </h2>
                  <span className="text-(length:--fs-xs) text-(--text-3)">{g.items.length}</span>
                </button>
              </section>
            );
          }
          const marks = dropIndexMarks(g.items, dragId, target, g.key);
          const done = status === "done";
          const open = g.items.filter((t) => t.status !== "done" && t.canEdit).map((t) => t.id);
          const archivable = g.items.filter((t) => t.canEdit);
          // 열 메뉴 항목. ⋯ 메뉴와 열 머리 우클릭 메뉴가 같이 쓴다
          const columnMenu = (Item: MenuItemComponent) => (
            <>
              {canAdd && <Item onSelect={() => setComposing(g.key)}>{tr("tasks.views.addTask")}</Item>}
              <Item onSelect={() => setCollapse(g.key, true)}>{tr("tasks.board.collapse")}</Item>
              {done ? (
                <Item
                  disabled={archivable.length === 0}
                  onSelect={() => void Promise.all(archivable.map((t) => update(t.id, { archived: true })))}
                >
                  {tr("tasks.board.archiveDone")}
                </Item>
              ) : (
                <Item disabled={open.length === 0} onSelect={() => void bulkUpdate(open, { status: "done" })}>
                  {tr("tasks.board.completeAll")}
                </Item>
              )}
              <Item onSelect={() => ctl.setState({ ...ctl.state, sort: { f: "priority", dir: 1 } })}>{tr("tasks.board.sortByPriority")}</Item>
            </>
          );
          return (
            <section
              key={g.key}
              aria-labelledby={headingId}
              data-drop-group={g.key}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-(--r-lg) bg-(--surface-2) max-[640px]:w-[248px]",
                target?.group === g.key && dragId && "ring-2 ring-(--accent-line)",
              )}
            >
              <KeyContextMenu label={tr("tasks.board.columnMenu", { group: g.label })} className="w-48" menu={columnMenu(ContextMenuItem)}>
                <div className="flex h-10 items-center gap-1.5 px-2.5">
                  <StatusIcon status={status} size={14} />
                  <h2 id={headingId} className="truncate text-(length:--fs-sm) font-semibold text-(--text)">
                    {g.label}
                  </h2>
                  <span className="text-(length:--fs-xs) text-(--text-3)">{g.items.length}</span>
                  <span className="flex-1" />
                  {canAdd && (
                    <button
                      type="button"
                      aria-label={tr("tasks.cell.addToGroup", { group: g.label })}
                      onClick={() => setComposing(g.key)}
                      className={iconBtn}
                    >
                      <Plus aria-hidden size={14} strokeWidth={1.8} />
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={tr("tasks.board.columnMenu", { group: g.label })} className={iconBtn}>
                        <MoreHorizontal aria-hidden size={15} strokeWidth={1.8} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {columnMenu(DropdownMenuItem)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </KeyContextMenu>
              <ul className="flex min-h-12 flex-col gap-2 px-2 pb-1">
                {g.items.map((t, i) => (
                  <Fragment key={t.id}>
                    {marks.before(i) && (
                      <li aria-hidden>
                        <DropLine />
                      </li>
                    )}
                    <Card t={t} ctl={ctl} groups={groups} dragging={dragId === t.id} onPointerDown={onPointerDown} />
                  </Fragment>
                ))}
                {marks.end && (
                  <li aria-hidden>
                    <DropLine />
                  </li>
                )}
              </ul>
              {canAdd && (
                <div className="px-2 pt-1 pb-2">
                  {composing === g.key ? (
                    <InlineComposer ctl={ctl} field="status" groupKey={g.key} onClose={() => setComposing(null)} />
                  ) : (
                    <AddTaskButton onClick={() => setComposing(g.key)} className="w-full" />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  t,
  ctl,
  groups,
  dragging,
  onPointerDown,
}: {
  t: TaskItem;
  ctl: ViewCtl;
  groups: TaskGroup[];
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, id: string) => void;
}) {
  const tr = useT();
  const { open } = useTaskDrawer();
  const checked = ctl.selected.has(t.id);
  const progress = t.subtaskTotal > 0 ? Math.round((t.subtaskDone / t.subtaskTotal) * 100) : 0;
  return (
    <TaskContextMenu task={t}>
      <li
        data-drag-id={t.id}
        tabIndex={0}
        aria-label={`${t.key} ${t.title}`}
        aria-describedby={t.canEdit ? MOVE_HINT_ID : undefined}
        onPointerDown={t.canEdit ? (e) => onPointerDown(e, t.id) : undefined}
        onClick={(e) => {
          if (isInnerControl(e.target)) return;
          // Shift·⌘/Ctrl 클릭은 다중 선택
          if (e.shiftKey || e.metaKey || e.ctrlKey) ctl.select(t.id, { range: e.shiftKey });
          else open(t.key);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter") {
            e.preventDefault();
            open(t.key);
          } else if (e.key === " ") {
            e.preventDefault();
            ctl.select(t.id, { range: e.shiftKey });
          } else {
            ctl.keyMove(e, t.id, groups, "status");
          }
        }}
        className={cn(
          "flex flex-col gap-2 rounded-(--r) select-none [-webkit-touch-callout:none] bg-(--surface) p-(--card-pad) shadow-(--shadow-card) outline-none hover:shadow-(--shadow-pop) focus-visible:ring-2 focus-visible:ring-(--accent)",
          t.canEdit ? "cursor-grab" : "cursor-pointer",
          checked && "ring-2 ring-(--accent)",
          dragging && "opacity-40",
        )}
      >
        {t.labels.length > 0 && <LabelChips labels={t.labels} max={3} />}
        <p className={cn("text-(length:--fs-base) leading-snug text-(--text)", t.status === "done" && "text-(--text-3) line-through")}>
          {t.title}
        </p>
        {t.subtaskTotal > 0 && (
          <div className="flex items-center gap-2 text-(length:--fs-2xs) text-(--text-3)">
            <span className="tabular-nums">
              {t.subtaskDone}/{t.subtaskTotal}
            </span>
            <span
              role="progressbar"
              aria-label={tr("tasks.board.subtaskProgress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-1 flex-1 overflow-hidden rounded-full bg-(--surface-3)"
            >
              <span className="block h-full rounded-full bg-(--green)" style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-(length:--fs-xs) text-(--text-3)">
          <TaskKey value={t.key} />
          <PriorityIcon priority={t.priority} size={13} />
          {t.due_date && <DueLabel due={t.due_date} done={t.status === "done"} now={ctl.now} />}
          <span className="flex-1" />
          {t.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={tr("tasks.board.comments", { count: t.commentCount })}>
              <MessageSquare aria-hidden size={12} strokeWidth={1.8} />
              {t.commentCount}
            </span>
          )}
          {t.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={tr("tasks.board.attachments", { count: t.attachmentCount })}>
              <Paperclip aria-hidden size={12} strokeWidth={1.8} />
              {t.attachmentCount}
            </span>
          )}
          {t.recur !== "none" && (
            <span role="img" aria-label={tr("tasks.board.repeat", { label: tr(`common.repeat.${t.recur}`) })} className="inline-flex">
              <Repeat aria-hidden size={12} strokeWidth={1.8} />
            </span>
          )}
          <AssigneeAvatar assignee={t.assignee} size={20} />
        </div>
      </li>
    </TaskContextMenu>
  );
}
