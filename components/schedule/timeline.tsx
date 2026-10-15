"use client";
// 타임라인 화면 본문. 왼쪽 작업 목록(고정 열)과 오른쪽 일 단위 그리드(주말 음영, 오늘 선, 마일스톤 행, 상태색 바, 의존성 화살표)를 한 가로 스크롤 영역에 그린다.
// 바·화살표 좌표는 DOM 측정 없이 날짜에서 계산하고, 끄는 동안의 미리보기 날짜도 같은 계산을 거쳐 화살표가 바를 따라온다
import { ChartGantt, ChevronDown, SearchX } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { AssigneeAvatar, StatusIcon } from "@/components/tasks/parts";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { FilterChipBar, TaskToolbar, useViewState } from "@/components/tasks/toolbar";
import { TOOLBAR_BTN } from "@/components/tasks/toolbar/task-toolbar";
import { announce } from "@/components/tasks/views/shared";
import { seoulDay } from "@/lib/format/date";
import { colorHex, GROUP_FIELD_LABELS, TASK_STATUS_LABELS } from "@/lib/i18n/labels";
import { addDays, diffDays, editBar, isWeekend, timelineRange, type BarEdit } from "@/lib/schedule/dates";
import type { Milestone } from "@/lib/schedule/types";
import type { GroupField, TaskItem, TaskPatch, ViewKey, ViewState } from "@/lib/tasks/types";
import { applyView } from "@/lib/tasks/view";
import { cn } from "@/lib/utils";

const ROW_H = 36;
const HEADER_H = 44;
// 확대 단계별 하루 폭(px)
const ZOOM = { week: 32, month: 10 } as const;
type Zoom = keyof typeof ZOOM;
const GROUPS: readonly GroupField[] = ["project", "status", "assignee", "none"];
// 이 거리보다 적게 움직이면 클릭(작업 열기)으로 본다
const THRESHOLD = 4;

const monthDayFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", year: "numeric", month: "long" });
const monthDay = (iso: string) => monthDayFmt.format(new Date(seoulDay(iso)));

type Row = { kind: "group"; key: string; label: string; count: number } | { kind: "task"; t: TaskItem };
type Dates = { start: string | null; due: string | null };
type Preview = { id: string } & Dates;

// 바가 차지하는 첫날·마지막 날. 한쪽만 있으면 1일 바
function span(d: Dates): [string, string] | null {
  const s = d.start ?? d.due;
  const e = d.due ?? d.start;
  return s && e ? [s, e] : null;
}

function rangeLabel(d: Dates) {
  const sp = span(d);
  if (!sp) return "일정 없음";
  return sp[0] === sp[1] ? monthDay(sp[0]) : `${monthDay(sp[0])}부터 ${monthDay(sp[1])}까지`;
}

export function Timeline({
  viewKey,
  initialState,
  milestones,
  todayIso,
  nowIso,
  projectId,
}: {
  viewKey: ViewKey;
  initialState: ViewState;
  milestones: Milestone[];
  todayIso: string;
  nowIso: string;
  // 프로젝트 탭이면 그 프로젝트 id. 드로어가 잠시 빌려 넣은 다른 프로젝트 작업을 뺀다
  projectId?: string;
}) {
  const { items: storeItems, workspace } = useTasks();
  const actions = useTaskActions();
  const { open } = useTaskDrawer();
  const [state, setState] = useViewState(workspace.id, viewKey, initialState);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [preview, setPreview] = useState<Preview | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const hintId = useId();
  // url(#…) 참조에 쓰므로 영숫자만 남긴다
  const arrowId = `tl-arrow${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const colW = ZOOM[zoom];

  const scoped = useMemo(
    () => (projectId ? storeItems.filter((t) => t.project_id === projectId) : storeItems),
    [storeItems, projectId],
  );
  const groups = useMemo(() => applyView(scoped, state, { now }), [scoped, state, now]);
  const rows = useMemo<Row[]>(
    () =>
      groups.flatMap((g): Row[] => [
        ...(state.group === "none" ? [] : [{ kind: "group" as const, key: g.key, label: g.label, count: g.items.length }]),
        ...g.items.map((t) => ({ kind: "task" as const, t })),
      ]),
    [groups, state.group],
  );
  const visible = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // 프로젝트 필터는 마일스톤에도 적용한다
  const shownMilestones = useMemo(
    () =>
      milestones.filter((m) =>
        state.filters.every(
          (f) => f.f !== "project" || f.v.length === 0 || f.v.includes(m.project.id) === (f.op === "is"),
        ),
      ),
    [milestones, state.filters],
  );

  // 날짜 범위는 저장된 날짜로만 정한다. 끄는 동안 범위가 바뀌면 좌표가 흔들린다
  const range = useMemo(() => {
    const dates = [
      ...visible.flatMap((t) => [t.start_date, t.due_date].filter((d): d is string => !!d)),
      ...shownMilestones.map((m) => m.date),
    ];
    return timelineRange(dates, todayIso);
  }, [visible, shownMilestones, todayIso]);
  const days = useMemo(() => Array.from({ length: range.days }, (_, i) => addDays(range.start, i)), [range]);
  const width = range.days * colW;
  const x = (iso: string) => diffDays(range.start, iso) * colW;

  const datesOf = (t: TaskItem): Dates =>
    preview?.id === t.id ? preview : { start: t.start_date, due: t.due_date };

  // 행 번호는 그룹을 가로질러 센다. 0번은 마일스톤 행
  const rowIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => r.kind === "task" && map.set(r.t.id, i + 1));
    return map;
  }, [rows]);

  // ─── 저장 ───
  const commit = (t: TaskItem, next: Dates) => {
    const patch: TaskPatch = {};
    if (next.start !== t.start_date) patch.start = next.start;
    if (next.due !== t.due_date) patch.due = next.due;
    if (Object.keys(patch).length === 0) return;
    // 실패하면 store가 되돌리고 토스트를 띄우므로 성공했을 때만 알린다
    void actions.update(t.id, patch).then((ok) => ok && announce(`${t.key} 작업 일정을 ${rangeLabel(next)}로 옮겼습니다`));
  };

  // ─── 스크롤. 처음과 "오늘"에서 오늘이 왼쪽 목록 바로 옆에 보이게 한다 ───
  const scroller = useRef<HTMLDivElement>(null);
  const scrollToToday = () => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(todayIso) - 80);
  };
  useEffect(scrollToToday, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = state.filters.some((f) => f.v.length > 0) || state.q.trim() !== "";
  const anyDated = visible.some((t) => t.start_date || t.due_date);
  const empty = scoped.every((t) => !t.start_date && !t.due_date);

  const toolbar = (
    <div className="px-(--gutter) pb-(--s-2)">
      <TaskToolbar state={state} onChange={setState} showColumns={false} showGroup={false}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={TOOLBAR_BTN}>
              그룹: {GROUP_FIELD_LABELS[state.group]}
              <ChevronDown aria-hidden size={13} strokeWidth={1.8} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36 rounded-(--r) bg-(--surface) shadow-(--shadow-pop) ring-0">
            <DropdownMenuRadioGroup value={state.group} onValueChange={(v) => setState({ ...state, group: v as GroupField })}>
              {GROUPS.map((g) => (
                <DropdownMenuRadioItem key={g} value={g}>
                  {GROUP_FIELD_LABELS[g]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={zoom}
          aria-label="확대"
          onValueChange={(v) => v && setZoom(v as Zoom)}
        >
          <ToggleGroupItem value="week" className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
            주
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
            월
          </ToggleGroupItem>
        </ToggleGroup>
        <Button variant="outline" size="sm" className="h-(--h-md) text-(length:--fs-sm)" onClick={scrollToToday}>
          오늘
        </Button>
      </TaskToolbar>
      <FilterChipBar state={state} onChange={setState} />
    </div>
  );

  // 보일 작업이 없을 때의 안내. 마일스톤이 있으면 그리드와 마일스톤 행은 그대로 두고 작업 자리에만 안내를 보인다
  const notice = empty ? (
    <EmptyState
      icon={ChartGantt}
      title="타임라인에 표시할 작업이 없습니다"
      description="작업에 시작일과 기한을 넣으면 여기에 보입니다."
    />
  ) : !anyDated ? (
    <EmptyState
      icon={SearchX}
      title="결과가 없습니다"
      description="이 조건에 맞는 작업이 없습니다."
      action={
        filtered && (
          <Button size="sm" variant="outline" onClick={() => setState({ ...state, filters: [], q: "" })}>
            필터 지우기
          </Button>
        )
      }
    />
  ) : null;
  if (notice && shownMilestones.length === 0) {
    return (
      <>
        {toolbar}
        {notice}
        <TaskDrawerHost />
      </>
    );
  }

  // 의존성 화살표. 선행 작업 바 끝 → 이 작업 바 시작. 둘 다 보이고 날짜가 있을 때만
  const arrows = visible.flatMap((t) => {
    const to = span(datesOf(t));
    const ti = rowIndex.get(t.id);
    if (!to || ti === undefined) return [];
    return t.blockedBy.flatMap((bid) => {
      const b = visible.find((v) => v.id === bid);
      const bi = rowIndex.get(bid);
      const from = b && span(datesOf(b));
      if (!from || bi === undefined) return [];
      const x1 = x(from[1]) + colW;
      const y1 = bi * ROW_H + ROW_H / 2;
      const x2 = x(to[0]);
      const y2 = ti * ROW_H + ROW_H / 2;
      const bend = Math.max(16, Math.abs(x2 - x1) / 2);
      return [{ key: `${bid}>${t.id}`, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 2} ${y2}` }];
    });
  });

  const bodyH = (rows.length + 1) * ROW_H;
  const todayX = x(todayIso);
  const months = days.filter((d, i) => i === 0 || d.endsWith("-01"));

  return (
    <>
      {toolbar}
      <p id={hintId} className="sr-only">
        Enter로 작업을 엽니다. 좌우 화살표로 일정을 하루씩 옮기고, Shift+좌우 화살표로 기한 끝을 조절합니다.
      </p>
      <div className="px-(--gutter) pb-(--s-6)">
        <div
          ref={scroller}
          data-drag-scroll
          className="overflow-x-auto rounded-(--r-lg) border border-(--border) bg-(--surface)"
        >
          <div className="flex w-max min-w-full">
            {/* 왼쪽 작업 목록. 가로 스크롤해도 제자리에 있고 화살표가 위로 올라오지 않게 덮는다 */}
            <div className="sticky left-0 z-10 w-36 shrink-0 border-r border-(--border) bg-(--surface) sm:w-72">
              <div
                style={{ height: HEADER_H }}
                className="flex items-end border-b border-(--border) bg-(--surface-2) px-3 pb-1.5 text-(length:--fs-2xs) font-medium text-(--text-3)"
              >
                작업
              </div>
              <div
                style={{ height: ROW_H }}
                className="flex items-center border-b border-(--divider) px-3 text-(length:--fs-xs) text-(--text-3)"
              >
                마일스톤
              </div>
              {rows.map((r) =>
                r.kind === "group" ? (
                  <div
                    key={`g:${r.key}`}
                    style={{ height: ROW_H }}
                    className="flex items-center gap-2 border-b border-(--divider) bg-(--surface-2) px-3 text-(length:--fs-xs) font-medium text-(--text-2)"
                  >
                    <span className="truncate">{r.label}</span>
                    <span className="text-(--text-4) tabular-nums">{r.count}</span>
                  </div>
                ) : (
                  <button
                    key={r.t.id}
                    type="button"
                    onClick={() => open(r.t.key)}
                    style={{ height: ROW_H }}
                    className="flex w-full min-w-0 items-center gap-2 border-b border-(--divider) px-3 text-left outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
                  >
                    <StatusIcon status={r.t.status} size={13} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-(length:--fs-sm)",
                        r.t.status === "done" ? "text-(--text-3) line-through" : "text-(--text)",
                      )}
                    >
                      {r.t.title}
                    </span>
                    {r.t.subtaskTotal > 0 && (
                      <span
                        aria-label={`하위 작업 ${r.t.subtaskTotal}개 중 ${r.t.subtaskDone}개 완료`}
                        className="hide-m shrink-0 text-(length:--fs-2xs) text-(--text-4) tabular-nums"
                      >
                        {r.t.subtaskDone}/{r.t.subtaskTotal}
                      </span>
                    )}
                    <AssigneeAvatar assignee={r.t.assignee} size={18} className="hide-m" />
                  </button>
                ),
              )}
            </div>

            {/* 오른쪽 일 단위 그리드 */}
            <div className="relative shrink-0" style={{ width }}>
              <div
                aria-hidden
                style={{ height: HEADER_H }}
                className="relative border-b border-(--border) bg-(--surface-2) text-(length:--fs-2xs) text-(--text-3)"
              >
                {months.map((d) => (
                  <span key={d} className="absolute top-1.5 pl-1.5 font-medium whitespace-nowrap" style={{ left: x(d) }}>
                    {monthFmt.format(new Date(seoulDay(d)))}
                  </span>
                ))}
                {days.map((d) =>
                  zoom === "week" || d === range.start || (diffDays(range.start, d) % 7 === 0) ? (
                    <span
                      key={d}
                      className={cn(
                        "absolute bottom-1.5 text-center tabular-nums",
                        isWeekend(d) && "text-(--text-4)",
                        d === todayIso && "font-semibold text-(--accent)",
                      )}
                      style={zoom === "week" ? { left: x(d), width: colW } : { left: x(d) + 2 }}
                    >
                      {Number(d.slice(8))}
                    </span>
                  ) : null,
                )}
              </div>

              <div
                className="relative"
                style={{
                  height: bodyH,
                  // 범위가 월요일에 시작하므로 매주 6·7번째 칸이 주말이다
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${5 * colW}px, var(--sunken) ${5 * colW}px ${7 * colW}px)`,
                }}
              >
                {/* 행 구분선과 그룹 행 배경 */}
                <div aria-hidden className="border-b border-(--divider)" style={{ height: ROW_H }} />
                {rows.map((r, i) => (
                  <div
                    key={r.kind === "group" ? `g:${r.key}` : r.t.id}
                    aria-hidden
                    className={cn("absolute inset-x-0 border-b border-(--divider)", r.kind === "group" && "bg-(--surface-2)")}
                    style={{ top: (i + 1) * ROW_H, height: ROW_H }}
                  />
                ))}

                <div
                  aria-hidden
                  data-today-line
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-(--accent)"
                  style={{ left: todayX + colW / 2 }}
                />

                {/* 마일스톤 행 */}
                {shownMilestones.map((m) => (
                  <Tooltip key={m.id}>
                    <TooltipTrigger asChild>
                      {/* 동작이 없어 버튼이 아니다. 키보드로도 툴팁을 볼 수 있게 포커스만 받는다 */}
                      <span
                        role="img"
                        tabIndex={0}
                        aria-label={`마일스톤 ${m.name}, ${monthDay(m.date)}, ${m.project.name}`}
                        className="absolute flex size-4 -translate-x-1/2 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                        style={{ left: x(m.date) + colW / 2, top: ROW_H / 2 - 8 }}
                      >
                        <span aria-hidden className="size-2.5 rotate-45 rounded-[2px]" style={{ background: colorHex(m.project.color) }} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {m.name} · {monthDay(m.date)}
                    </TooltipContent>
                  </Tooltip>
                ))}

                {rows.map((r, i) => {
                  if (r.kind !== "task") return null;
                  const d = datesOf(r.t);
                  const sp = span(d);
                  const top = (i + 1) * ROW_H;
                  if (!sp) {
                    return (
                      <span
                        key={r.t.id}
                        className="absolute flex items-center text-(length:--fs-2xs) whitespace-nowrap text-(--text-4)"
                        style={{ top, height: ROW_H, left: todayX + colW + 6 }}
                      >
                        일정 없음
                      </span>
                    );
                  }
                  return (
                    <Bar
                      key={r.t.id}
                      t={r.t}
                      dates={d}
                      hintId={hintId}
                      left={x(sp[0])}
                      width={(diffDays(sp[0], sp[1]) + 1) * colW}
                      top={top}
                      colW={colW}
                      onPreview={(next) => setPreview(next && { id: r.t.id, ...next })}
                      onCommit={(next) => {
                        commit(r.t, next);
                        setPreview(null);
                      }}
                      onOpen={() => open(r.t.key)}
                    />
                  );
                })}

                <svg
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  width={width}
                  height={bodyH}
                >
                  <defs>
                    <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0 0 L8 4 L0 8 Z" fill="var(--text-3)" />
                    </marker>
                  </defs>
                  {arrows.map((a) => (
                    <path
                      key={a.key}
                      data-dep={a.key}
                      d={a.d}
                      fill="none"
                      stroke="var(--text-3)"
                      strokeWidth={1.3}
                      markerEnd={`url(#${arrowId})`}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
        {notice}
      </div>
      <TaskDrawerHost />
    </>
  );
}

// 작업 바. 가운데를 끌면 전체 이동, 양 끝 손잡이를 끌면 시작·기한만 조절한다. 일 단위로 맞춘다
function Bar({
  t,
  dates,
  hintId,
  left,
  width,
  top,
  colW,
  onPreview,
  onCommit,
  onOpen,
}: {
  t: TaskItem;
  dates: Dates;
  hintId: string;
  left: number;
  width: number;
  top: number;
  colW: number;
  onPreview: (next: Dates | null) => void;
  onCommit: (next: Dates) => void;
  onOpen: () => void;
}) {
  const drag = useRef<{ pointerId: number; x0: number; edit: BarEdit; delta: number; moved: boolean } | null>(null);
  // 끈 직후 따라오는 click이 작업을 열지 않게 한다
  const suppressClick = useRef(false);
  const base = { start: t.start_date, due: t.due_date };
  const done = t.status === "done";

  // 편집 권한이 없으면 끌기·키보드 이동 없이 열기만 한다
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !t.canEdit) return;
    const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-edge]")?.dataset.edge;
    drag.current = { pointerId: e.pointerId, x0: e.clientX, edit: (edge as BarEdit) ?? "move", delta: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < THRESHOLD) return;
    d.moved = true;
    const delta = Math.round(dx / colW);
    if (delta === d.delta) return;
    d.delta = delta;
    onPreview(editBar(base.start, base.due, d.edit, delta));
  };
  const end = (e: React.PointerEvent<HTMLButtonElement>, drop: boolean) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    suppressClick.current = true;
    if (drop && d.delta !== 0) onCommit(editBar(base.start, base.due, d.edit, d.delta));
    else onPreview(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape" && drag.current) {
      e.preventDefault();
      e.currentTarget.releasePointerCapture(drag.current.pointerId);
      // 취소한 뒤 손을 떼며 오는 click이 작업을 열지 않게 한다
      if (drag.current.moved) suppressClick.current = true;
      drag.current = null;
      onPreview(null);
      return;
    }
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !t.canEdit) return;
    // 스크롤 영역이 함께 밀리지 않게 막는다
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    onCommit(editBar(base.start, base.due, e.shiftKey ? "due" : "move", step));
  };

  const color = `var(--st-${t.status})`;
  return (
    <button
      type="button"
      data-bar={t.id}
      aria-label={`${t.key} ${t.title}, ${TASK_STATUS_LABELS[t.status]}, ${rangeLabel(dates)}`}
      aria-describedby={t.canEdit ? hintId : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, true)}
      onPointerCancel={(e) => end(e, false)}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        "group/bar absolute flex items-center overflow-hidden rounded-(--r-sm) border text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-(--accent)",
        t.canEdit ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
      )}
      style={{
        left,
        width,
        top: top + 6,
        height: ROW_H - 12,
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      <span
        data-edge="start"
        aria-hidden
        hidden={!t.canEdit}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100"
        style={{ background: `color-mix(in srgb, ${color} 45%, transparent)` }}
      />
      {width >= 48 && (
        <span
          className={cn(
            "pointer-events-none truncate px-2.5 text-(length:--fs-2xs) font-medium",
            done ? "text-(--text-3) line-through" : "text-(--text)",
          )}
        >
          {t.title}
        </span>
      )}
      <span
        data-edge="due"
        aria-hidden
        hidden={!t.canEdit}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100"
        style={{ background: `color-mix(in srgb, ${color} 45%, transparent)` }}
      />
    </button>
  );
}
