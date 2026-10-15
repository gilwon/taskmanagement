"use client";
// 목록 뷰. 그룹 헤더(접기·개수·+), 작업 행(선택·키·제목·상태·담당자·우선순위·기한·프로젝트·⋯), 그룹 하단 인라인 컴포저, 행 드래그
import { ChevronRight, GripVertical, ListChecks, Plus } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectIcon } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AssigneeAvatar,
  AssigneePicker,
  DatePicker,
  DueLabel,
  PriorityIcon,
  PriorityPicker,
  StatusIcon,
  StatusPicker,
  TaskKey,
} from "@/components/tasks/parts";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import {
  AddTaskButton,
  DropLine,
  InlineComposer,
  isInnerControl,
  MOVE_HINT_ID,
  MoveHint,
  TaskMenu,
  TitleEditor,
  dropIndexMarks,
  type ViewCtl,
} from "@/components/tasks/views/shared";
import { useTaskDrag } from "@/components/tasks/views/use-drag";
import { formatDue } from "@/lib/format/date";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, UNASSIGNED_LABEL } from "@/lib/i18n/labels";
import type { GroupField, TaskGroup, TaskItem, TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export const cellBtn =
  "inline-flex h-(--h-sm) shrink-0 items-center justify-center gap-1 rounded-(--r-xs) px-1 outline-none hover:bg-(--surface-3) focus-visible:ring-2 focus-visible:ring-(--accent)";

// 더블클릭과 구분하려고 제목 한 번 클릭은 이만큼 기다렸다 드로어를 연다
const DBL_WAIT = 220;

export function ListView({ ctl, groups, empty }: { ctl: ViewCtl; groups: TaskGroup[]; empty: boolean }) {
  const field = ctl.state.group;
  const { dragId, target, onPointerDown } = useTaskDrag((id, t) => ctl.drop(id, t, groups, field));
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [composing, setComposing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // 작업이 하나도 없으면 빈 상태를 먼저 보이고, "작업 추가"를 누르면 첫 그룹 컴포저를 연다
  const [showEmpty, setShowEmpty] = useState(true);

  if (empty && showEmpty && composing === null) {
    return (
      <EmptyState
        icon={ListChecks}
        title="작업이 없습니다"
        description="작업을 추가해 일을 시작하세요."
        action={
          <Button
            size="sm"
            onClick={() => {
              setShowEmpty(false);
              setComposing(groups.find((g) => ctl.canAssign(field, g.key))?.key ?? null);
            }}
          >
            <Plus aria-hidden strokeWidth={1.8} /> 작업 추가
          </Button>
        }
      />
    );
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="pb-(--s-8)">
      <MoveHint />
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        const marks = dropIndexMarks(g.items, dragId, target, g.key);
        const headingId = `list-group-${field}-${g.key}`;
        const canAdd = ctl.canAssign(field, g.key);
        return (
          <section
            key={g.key}
            aria-labelledby={headingId}
            data-drop-group={g.key}
            className={cn(target?.group === g.key && dragId && "bg-(--accent-soft)/40")}
          >
            <div className="flex h-9 items-center gap-1 border-b border-(--border) bg-(--bg) px-(--gutter)">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggle(g.key)}
                className="-ml-1 flex h-(--h-sm) min-w-0 items-center gap-1.5 rounded-(--r-xs) px-1 outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
              >
                <ChevronRight
                  aria-hidden
                  size={14}
                  strokeWidth={1.8}
                  className={cn("text-(--text-3) transition-transform duration-(--dur)", !isCollapsed && "rotate-90")}
                />
                {field === "status" && <StatusIcon status={g.key as TaskStatus} size={14} />}
                <h2 id={headingId} className="truncate text-(length:--fs-sm) font-semibold text-(--text)">
                  {g.label}
                </h2>
                <span className="text-(length:--fs-xs) text-(--text-3)">{g.items.length}</span>
              </button>
              {canAdd && (
                <button
                  type="button"
                  aria-label={`${g.label}에 작업 추가`}
                  onClick={() => {
                    if (isCollapsed) toggle(g.key);
                    setComposing(g.key);
                  }}
                  className="inline-flex size-(--h-sm) items-center justify-center rounded-(--r-xs) text-(--text-3) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  <Plus aria-hidden size={14} strokeWidth={1.8} />
                </button>
              )}
            </div>
            {!isCollapsed && (
              <>
                <ul>
                  {g.items.map((t, i) => (
                    <Fragment key={t.id}>
                      {marks.before(i) && (
                        <li aria-hidden className="px-(--gutter)">
                          <DropLine />
                        </li>
                      )}
                      <Row
                        t={t}
                        ctl={ctl}
                        dragging={dragId === t.id}
                        editing={editing === t.id}
                        onEdit={() => setEditing(t.id)}
                        onEditDone={() => setEditing(null)}
                        onPointerDown={onPointerDown}
                        groups={groups}
                        field={field}
                      />
                    </Fragment>
                  ))}
                  {marks.end && (
                    <li aria-hidden className="px-(--gutter)">
                      <DropLine />
                    </li>
                  )}
                </ul>
                {canAdd && (
                  <div className="px-(--gutter) py-1">
                    {composing === g.key ? (
                      <InlineComposer ctl={ctl} field={field} groupKey={g.key} onClose={() => setComposing(null)} />
                    ) : (
                      <AddTaskButton onClick={() => setComposing(g.key)} />
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({
  t,
  ctl,
  dragging,
  editing,
  onEdit,
  onEditDone,
  onPointerDown,
  groups,
  field,
}: {
  t: TaskItem;
  ctl: ViewCtl;
  dragging: boolean;
  editing: boolean;
  onEdit: () => void;
  onEditDone: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  groups: TaskGroup[];
  field: GroupField;
}) {
  const { open } = useTaskDrawer();
  const { move, update } = useTaskActions();
  const { members } = useTasks();
  const checked = ctl.selected.has(t.id);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <li
      data-drag-id={t.id}
      tabIndex={0}
      aria-label={`${t.key} ${t.title}`}
      aria-describedby={MOVE_HINT_ID}
      onPointerDown={(e) => !editing && onPointerDown(e, t.id)}
      onClick={(e) => {
        if (editing || isInnerControl(e.target)) return;
        open(t.key);
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
          ctl.keyMove(e, t.id, groups, field);
        }
      }}
      className={cn(
        "group/row flex h-(--row-h) cursor-default items-center gap-2 border-b border-(--divider) px-(--gutter) text-(length:--fs-base) outline-none hover:bg-(--surface-2) focus-visible:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset max-[640px]:gap-1.5",
        checked && "bg-(--accent-soft) hover:bg-(--accent-soft)",
        dragging && "opacity-40",
      )}
    >
      <span
        data-drag-handle
        aria-hidden
        className="-ml-3 flex w-3 shrink-0 cursor-grab touch-none justify-center text-(--text-4) opacity-0 group-hover/row:opacity-100 max-[900px]:opacity-100"
      >
        <GripVertical size={13} strokeWidth={1.8} />
      </span>
      <Checkbox
        checked={checked}
        aria-label={`${t.key} 선택`}
        onClick={(e) => {
          e.stopPropagation();
          ctl.select(t.id, { range: e.shiftKey });
        }}
      />
      <StatusPicker value={t.status} onChange={(s) => s && s !== t.status && void move(t.id, s)}>
        <button type="button" aria-label={`상태 ${TASK_STATUS_LABELS[t.status]}, 바꾸기`} className={cellBtn}>
          <StatusIcon status={t.status} size={14} />
        </button>
      </StatusPicker>
      <TaskKey value={t.key} className="hide-m w-16 shrink-0" />
      {editing ? (
        <TitleEditor task={t} onDone={onEditDone} />
      ) : (
        <span
          data-no-row-click
          onClick={() => {
            if (clickTimer.current) clearTimeout(clickTimer.current);
            clickTimer.current = setTimeout(() => open(t.key), DBL_WAIT);
          }}
          onDoubleClick={() => {
            if (clickTimer.current) clearTimeout(clickTimer.current);
            onEdit();
          }}
          className={cn("min-w-0 flex-1 truncate text-(--text)", t.status === "done" && "text-(--text-3) line-through")}
        >
          {t.title}
        </span>
      )}
      {ctl.showProject && (
        <span className="flex w-36 shrink-0 items-center gap-1.5 truncate text-(length:--fs-sm) text-(--text-3) max-[900px]:hidden">
          <ProjectIcon icon={t.project.icon} color={t.project.color} size={16} />
          <span className="truncate">{t.project.name}</span>
        </span>
      )}
      <AssigneePicker
        value={t.assignee_id}
        members={members}
        onChange={(v) => v !== undefined && v !== t.assignee_id && void update(t.id, { assigneeId: v })}
      >
        <button type="button" aria-label={`담당자 ${t.assignee?.name ?? UNASSIGNED_LABEL}, 바꾸기`} className={cellBtn}>
          <AssigneeAvatar assignee={t.assignee} size={20} />
        </button>
      </AssigneePicker>
      <PriorityPicker
        value={t.priority}
        onChange={(p) => p && p !== t.priority && void update(t.id, { priority: p })}
      >
        <button
          type="button"
          aria-label={`${t.priority === "none" ? "" : "우선순위 "}${TASK_PRIORITY_LABELS[t.priority]}, 바꾸기`}
          className={cn(cellBtn, "hide-m")}
        >
          <PriorityIcon priority={t.priority} size={14} />
        </button>
      </PriorityPicker>
      <DatePicker label="기한" value={t.due_date} onChange={(d) => d !== t.due_date && void update(t.id, { due: d })}>
        <button
          type="button"
          aria-label={`기한 ${t.due_date ? formatDue(t.due_date, ctl.now) : "없음"}, 바꾸기`}
          className={cn(cellBtn, "w-20 justify-start text-(length:--fs-sm) max-[640px]:w-14")}
        >
          {t.due_date ? (
            <DueLabel due={t.due_date} done={t.status === "done"} now={ctl.now} />
          ) : (
            <span className="truncate text-(--text-4)">날짜 지정</span>
          )}
        </button>
      </DatePicker>
      <TaskMenu task={t} onRename={onEdit} />
    </li>
  );
}
