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
import { REPEAT_LABELS } from "@/lib/i18n/labels";
import type { TaskGroup, TaskItem, TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const iconBtn =
  "inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) outline-none hover:bg-(--surface-3) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)";

export function BoardView({ ctl, groups }: { ctl: ViewCtl; groups: TaskGroup[] }) {
  const { dragId, target, onPointerDown } = useTaskDrag((id, t) => ctl.drop(id, t, groups, "status"));
  const { bulkUpdate, update } = useTaskActions();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [composing, setComposing] = useState<string | null>(null);

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
          const open = g.items.filter((t) => t.status !== "done").map((t) => t.id);
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
              <div className="flex h-10 items-center gap-1.5 px-2.5">
                <StatusIcon status={status} size={14} />
                <h2 id={headingId} className="truncate text-(length:--fs-sm) font-semibold text-(--text)">
                  {g.label}
                </h2>
                <span className="text-(length:--fs-xs) text-(--text-3)">{g.items.length}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`${g.label}에 작업 추가`}
                  onClick={() => setComposing(g.key)}
                  className={iconBtn}
                >
                  <Plus aria-hidden size={14} strokeWidth={1.8} />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`${g.label} 열 메뉴`} className={iconBtn}>
                      <MoreHorizontal aria-hidden size={15} strokeWidth={1.8} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => setComposing(g.key)}>작업 추가</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setCollapse(g.key, true)}>열 접기</DropdownMenuItem>
                    {done ? (
                      <DropdownMenuItem
                        disabled={g.items.length === 0}
                        onSelect={() => void Promise.all(g.items.map((t) => update(t.id, { archived: true })))}
                      >
                        완료 항목 보관
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={open.length === 0}
                        onSelect={() => void bulkUpdate(open, { status: "done" })}
                      >
                        모두 완료로 표시
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => ctl.setState({ ...ctl.state, sort: { f: "priority", dir: 1 } })}>
                      우선순위로 정렬
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
              <div className="px-2 pt-1 pb-2">
                {composing === g.key ? (
                  <InlineComposer ctl={ctl} field="status" groupKey={g.key} onClose={() => setComposing(null)} />
                ) : (
                  <AddTaskButton onClick={() => setComposing(g.key)} className="w-full" />
                )}
              </div>
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
  const { open } = useTaskDrawer();
  const checked = ctl.selected.has(t.id);
  const progress = t.subtaskTotal > 0 ? Math.round((t.subtaskDone / t.subtaskTotal) * 100) : 0;
  return (
    <li
      data-drag-id={t.id}
      tabIndex={0}
      aria-label={`${t.key} ${t.title}`}
      aria-describedby={MOVE_HINT_ID}
      onPointerDown={(e) => onPointerDown(e, t.id)}
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
        "flex cursor-grab flex-col gap-2 rounded-(--r) select-none [-webkit-touch-callout:none] bg-(--surface) p-(--card-pad) shadow-(--shadow-card) outline-none hover:shadow-(--shadow-pop) focus-visible:ring-2 focus-visible:ring-(--accent)",
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
            aria-label="서브태스크 진행률"
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
          <span className="inline-flex items-center gap-0.5" aria-label={`댓글 ${t.commentCount}개`}>
            <MessageSquare aria-hidden size={12} strokeWidth={1.8} />
            {t.commentCount}
          </span>
        )}
        {t.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-0.5" aria-label={`첨부 ${t.attachmentCount}개`}>
            <Paperclip aria-hidden size={12} strokeWidth={1.8} />
            {t.attachmentCount}
          </span>
        )}
        {t.recur !== "none" && (
          <span role="img" aria-label={`반복 ${REPEAT_LABELS[t.recur]}`} className="inline-flex">
            <Repeat aria-hidden size={12} strokeWidth={1.8} />
          </span>
        )}
        <AssigneeAvatar assignee={t.assignee} size={20} />
      </div>
    </li>
  );
}
