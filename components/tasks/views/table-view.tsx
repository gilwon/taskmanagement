"use client";
// 표 뷰. 열 숨김·폭(ViewState.hidden·colW), 머리글 클릭 정렬, 제목·예상 시간 인라인 편집, 행 선택. 좁은 화면은 표 영역 안에서만 가로 스크롤한다
import { ArrowDown, ArrowUp, ListChecks } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectIcon } from "@/components/shell/project-icon";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AssigneeAvatar,
  AssigneePicker,
  DatePicker,
  DueLabel,
  EstimateInput,
  LabelChips,
  LabelPicker,
  PriorityIcon,
  PriorityPicker,
  StatusIcon,
  StatusPicker,
  TaskKey,
} from "@/components/tasks/parts";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { TaskContextMenu } from "@/components/tasks/views/task-context-menu";
import { cellBtn } from "@/components/tasks/views/list-view";
import { EditCell, TaskMenu, TitleEditor, isInnerControl, type ViewCtl } from "@/components/tasks/views/shared";
import { formatDue } from "@/lib/format/date";
import {
  COLUMN_LABELS,
  ESTIMATE_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
} from "@/lib/i18n/labels";
import { COLUMN_KEYS, type ColumnKey, type SortField, type TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const COL_MIN = 64;
const COL_MAX = 1200;
const DEFAULT_W: Record<ColumnKey, number> = {
  task: 360,
  status: 128,
  priority: 112,
  assignee: 156,
  due: 112,
  start: 112,
  labels: 180,
  deps: 140,
  estimate: 104,
  created: 112,
  project: 168,
};
// 머리글 클릭으로 정렬할 수 있는 열과 정렬 필드
const SORT_OF: Partial<Record<ColumnKey, SortField>> = {
  task: "title",
  status: "status",
  priority: "priority",
  assignee: "assignee",
  due: "due",
  start: "start",
  created: "created",
};
const CHECK_W = 40;
const MENU_W = 40;

export function TableView({ ctl, items, empty }: { ctl: ViewCtl; items: TaskItem[]; empty: boolean }) {
  const { state, setState } = ctl;
  const { items: all } = useTasks();
  const [editing, setEditing] = useState<string | null>(null);
  // 열 폭을 끄는 동안의 임시 폭. 놓을 때 뷰 상태에 저장한다
  const [live, setLive] = useState<{ col: ColumnKey; w: number } | null>(null);
  const keyOf = useMemo(() => new Map(all.map((t) => [t.id, t.key])), [all]);

  const cols = COLUMN_KEYS.filter((c) => !state.hidden.includes(c) && (ctl.showProject || c !== "project"));
  const width = (c: ColumnKey) => (live?.col === c ? live.w : (state.colW[c] ?? DEFAULT_W[c]));
  const total = CHECK_W + MENU_W + cols.reduce((sum, c) => sum + width(c), 0);
  const saveWidth = (c: ColumnKey, w: number) =>
    setState({ ...state, colW: { ...state.colW, [c]: Math.min(COL_MAX, Math.max(COL_MIN, Math.round(w))) } });

  if (items.length === 0) {
    return empty ? (
      <EmptyState icon={ListChecks} title="작업이 없습니다" description="작업을 추가해 일을 시작하세요." />
    ) : null;
  }

  const sortBy = (f: SortField) =>
    setState({ ...state, sort: state.sort.f === f ? { f, dir: state.sort.dir === 1 ? -1 : 1 } : { f, dir: 1 } });

  return (
    // relative가 없으면 머리글의 sr-only(absolute)가 스크롤 영역 밖 문서 기준으로 놓여 페이지 가로 스크롤을 만든다
    <div className="relative mx-(--gutter) mb-(--s-8) overflow-x-auto rounded-(--r) border border-(--border)">
      <table className="table-fixed border-collapse text-(length:--fs-base)" style={{ width: total }}>
        <colgroup>
          <col style={{ width: CHECK_W }} />
          {cols.map((c) => (
            <col key={c} style={{ width: width(c) }} />
          ))}
          <col style={{ width: MENU_W }} />
        </colgroup>
        <thead className="bg-(--surface-2)">
          <tr className="h-9 border-b border-(--border) text-left text-(length:--fs-xs) text-(--text-3)">
            <th scope="col">
              <span className="sr-only">선택</span>
            </th>
            {cols.map((c) => {
              const f = SORT_OF[c];
              const active = f && state.sort.f === f;
              return (
                <th
                  key={c}
                  scope="col"
                  aria-sort={active ? (state.sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className="relative px-2 font-medium"
                >
                  {f ? (
                    <button
                      type="button"
                      onClick={() => sortBy(f)}
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-(--r-xs) outline-none hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
                    >
                      {COLUMN_LABELS[c]}
                      {active &&
                        (state.sort.dir === 1 ? (
                          <ArrowUp aria-hidden size={12} strokeWidth={1.8} />
                        ) : (
                          <ArrowDown aria-hidden size={12} strokeWidth={1.8} />
                        ))}
                    </button>
                  ) : (
                    <span className="truncate">{COLUMN_LABELS[c]}</span>
                  )}
                  <ResizeHandle
                    label={COLUMN_LABELS[c]}
                    width={width(c)}
                    onLive={(w) => setLive({ col: c, w })}
                    onCommit={(w) => {
                      setLive(null);
                      saveWidth(c, w);
                    }}
                  />
                </th>
              );
            })}
            <th scope="col">
              <span className="sr-only">메뉴</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <Row
              key={t.id}
              t={t}
              ctl={ctl}
              cols={cols}
              keyOf={keyOf}
              editing={editing === t.id}
              onEdit={() => setEditing(t.id)}
              onEditDone={() => setEditing(null)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 열 오른쪽 가장자리의 폭 조절 손잡이. 포인터로 끌거나 좌우 화살표로 16px씩 바꾼다
function ResizeHandle({
  label,
  width,
  onLive,
  onCommit,
}: {
  label: string;
  width: number;
  onLive: (w: number) => void;
  onCommit: (w: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (w: number) => Math.min(COL_MAX, Math.max(COL_MIN, w));
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`${label} 열 폭`}
      aria-valuenow={width}
      aria-valuemin={COL_MIN}
      aria-valuemax={COL_MAX}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => start.current && onLive(clamp(start.current.w + e.clientX - start.current.x))}
      onPointerUp={(e) => {
        if (!start.current) return;
        const w = clamp(start.current.w + e.clientX - start.current.x);
        start.current = null;
        onCommit(w);
      }}
      onPointerCancel={() => {
        start.current = null;
        onCommit(width);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        onCommit(clamp(width + (e.key === "ArrowRight" ? 16 : -16)));
      }}
      className="absolute top-1 right-0 bottom-1 w-1.5 cursor-col-resize touch-none rounded-full outline-none hover:bg-(--accent-line) focus-visible:bg-(--accent)"
    />
  );
}

function Row({
  t,
  ctl,
  cols,
  keyOf,
  editing,
  onEdit,
  onEditDone,
}: {
  t: TaskItem;
  ctl: ViewCtl;
  cols: ColumnKey[];
  keyOf: Map<string, string>;
  editing: boolean;
  onEdit: () => void;
  onEditDone: () => void;
}) {
  const { open } = useTaskDrawer();
  const { move, update } = useTaskActions();
  const { members } = useTasks();
  const checked = ctl.selected.has(t.id);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cell = (c: ColumnKey) => {
    switch (c) {
      case "task":
        return (
          <div className="flex min-w-0 items-center gap-2">
            <TaskKey value={t.key} className="shrink-0" />
            {editing ? (
              <TitleEditor task={t} onDone={onEditDone} />
            ) : (
              <span
                data-no-row-click
                onClick={() => {
                  if (clickTimer.current) clearTimeout(clickTimer.current);
                  clickTimer.current = setTimeout(() => open(t.key), 220);
                }}
                onDoubleClick={() => {
                  if (clickTimer.current) clearTimeout(clickTimer.current);
                  if (t.canEdit) onEdit();
                }}
                className={cn("truncate text-(--text)", t.status === "done" && "text-(--text-3) line-through")}
              >
                {t.title}
              </span>
            )}
          </div>
        );
      case "status":
        return (
          <EditCell
            canEdit={t.canEdit}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <StatusPicker value={t.status} onChange={(s) => s && s !== t.status && void move(t.id, s)}>
                {b}
              </StatusPicker>
            )}
          >
            <StatusIcon status={t.status} size={14} />
            <span className="truncate">{TASK_STATUS_LABELS[t.status]}</span>
          </EditCell>
        );
      case "priority":
        return (
          <EditCell
            canEdit={t.canEdit}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <PriorityPicker value={t.priority} onChange={(p) => p && p !== t.priority && void update(t.id, { priority: p })}>
                {b}
              </PriorityPicker>
            )}
          >
            <PriorityIcon priority={t.priority} size={14} />
            <span className="truncate">{TASK_PRIORITY_LABELS[t.priority]}</span>
          </EditCell>
        );
      case "assignee":
        return (
          <EditCell
            canEdit={t.canEdit}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <AssigneePicker
                value={t.assignee_id}
                members={members}
                onChange={(v) => v !== undefined && v !== t.assignee_id && void update(t.id, { assigneeId: v })}
              >
                {b}
              </AssigneePicker>
            )}
          >
            <AssigneeAvatar assignee={t.assignee} size={20} />
            <span className={cn("truncate", !t.assignee && "text-(--text-4)")}>
              {t.assignee?.name ?? UNASSIGNED_LABEL}
            </span>
          </EditCell>
        );
      case "due":
        return (
          <EditCell
            canEdit={t.canEdit}
            label={`기한 ${t.due_date ? formatDue(t.due_date, ctl.now) : "없음"}, 바꾸기`}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <DatePicker label="기한" value={t.due_date} onChange={(d) => d !== t.due_date && void update(t.id, { due: d })}>
                {b}
              </DatePicker>
            )}
          >
            {t.due_date ? (
              <DueLabel due={t.due_date} done={t.status === "done"} now={ctl.now} />
            ) : (
              <span className="text-(--text-4)">{t.canEdit ? "날짜 지정" : "—"}</span>
            )}
          </EditCell>
        );
      case "start":
        return (
          <EditCell
            canEdit={t.canEdit}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <DatePicker
                label="시작일"
                value={t.start_date}
                onChange={(d) => d !== t.start_date && void update(t.id, { start: d })}
              >
                {b}
              </DatePicker>
            )}
          >
            {t.start_date ? (
              formatDue(t.start_date, ctl.now)
            ) : (
              <span className="text-(--text-4)">{t.canEdit ? "날짜 지정" : "—"}</span>
            )}
          </EditCell>
        );
      case "labels":
        return (
          <EditCell
            canEdit={t.canEdit}
            label={`${t.key} 라벨 바꾸기`}
            className={cn(cellBtn, "max-w-full justify-start")}
            wrap={(b) => (
              <LabelPicker value={t.labels} onChange={(l) => void update(t.id, { labels: l })}>
                {b}
              </LabelPicker>
            )}
          >
            {t.labels.length > 0 ? <LabelChips labels={t.labels} max={2} /> : <span className="text-(--text-4)">—</span>}
          </EditCell>
        );
      case "deps":
        return (
          <span className="truncate text-(length:--fs-sm) text-(--text-3)">
            {t.blockedBy.length > 0 ? t.blockedBy.map((id) => keyOf.get(id) ?? "?").join(", ") : "—"}
          </span>
        );
      case "estimate":
        return (
          <EditCell
            canEdit={t.canEdit}
            label={`${t.key} 예상 시간 바꾸기`}
            className={cn(cellBtn, "max-w-full")}
            wrap={(b) => (
              <EstimateInput value={t.estimate} onChange={(v) => v !== t.estimate && void update(t.id, { estimate: v })}>
                {b}
              </EstimateInput>
            )}
          >
            {t.estimate ? (
              (ESTIMATE_LABELS[t.estimate as keyof typeof ESTIMATE_LABELS] ?? t.estimate)
            ) : (
              <span className="text-(--text-4)">—</span>
            )}
          </EditCell>
        );
      case "created":
        return <span className="text-(length:--fs-sm) text-(--text-3)">{formatDue(t.created_at, ctl.now)}</span>;
      case "project":
        return (
          <span className="flex min-w-0 items-center gap-1.5 text-(length:--fs-sm) text-(--text-2)">
            <ProjectIcon icon={t.project.icon} color={t.project.color} size={16} />
            <span className="truncate">{t.project.name}</span>
          </span>
        );
    }
  };

  return (
    <TaskContextMenu task={t}>
      <tr
        data-state={checked ? "selected" : undefined}
        onClick={(e) => {
          if (editing || isInnerControl(e.target)) return;
          open(t.key);
        }}
        className={cn(
          "h-(--row-h) cursor-default border-b border-(--divider) last:border-0 hover:bg-(--surface-2)",
          checked && "bg-(--accent-soft) hover:bg-(--accent-soft)",
        )}
      >
        <td className="px-3">
          <Checkbox
            checked={checked}
            aria-label={`${t.key} 선택`}
            onClick={(e) => {
              e.stopPropagation();
              ctl.select(t.id, { range: e.shiftKey });
            }}
          />
        </td>
        {cols.map((c) => (
          <td key={c} className="overflow-hidden px-2">
            {cell(c)}
          </td>
        ))}
        <td className="px-1">
          <TaskMenu task={t} onRename={onEdit} />
        </td>
      </tr>
    </TaskContextMenu>
  );
}
