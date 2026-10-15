"use client";
// 월·주 캘린더 그리드. 작업은 기한(due_date) 날짜 칸에, 일정(events)은 그 날짜 칸에 그린다.
// store·URL·머리말 내비를 모르는 표시 부품이라 캘린더 화면과 내 작업 캘린더 모드가 함께 쓴다
import { Plus } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { StatusIcon } from "@/components/tasks/parts";
import { announce } from "@/components/tasks/views/shared";
import { useTaskDrag, type DropTarget } from "@/components/tasks/views/use-drag";
import { formatMonthTitle, seoulDay } from "@/lib/format/date";
import { colorHex, WEEKDAY_SHORT_LABELS } from "@/lib/i18n/labels";
import { addDays, monthGrid, monthOf, moveKeepingSpan, weekdayIndex, weekOf } from "@/lib/schedule/dates";
import type { CalendarEvent, CalendarMode } from "@/lib/schedule/types";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

// 일정 타입은 lib/schedule/types에 있다. 기존 import 경로를 위해 여기서도 내보낸다
export type { CalendarEvent, CalendarMode } from "@/lib/schedule/types";

export type MonthCalendarProps = {
  // 이미 필터를 적용한 작업. due_date가 없는 작업은 그리지 않는다
  items: TaskItem[];
  events?: CalendarEvent[];
  // "YYYY-MM-DD". month면 그 날짜가 속한 달, week면 그 날짜가 속한 주(월요일 시작)
  anchor: string;
  mode?: CalendarMode;
  // 서버가 서울 기준으로 만든 오늘 "YYYY-MM-DD". 하이드레이션이 어긋나지 않게 클라이언트에서 계산하지 않는다
  todayIso: string;
  onOpenTask: (key: string) => void;
  // 다른 날로 끌어 놓은 작업. 기간을 유지한 새 기한·시작일이 온다. 없으면 작업을 끌 수 없다.
  // 저장 성공 여부(Promise<boolean>)를 돌려주면 성공했을 때만 화면 읽기 프로그램에 알린다
  onMoveTask?: (id: string, patch: { due: string; start: string | null }) => Promise<boolean> | void;
  // 다른 날로 끌어 놓은 일정. 없으면 일정을 끌 수 없다. 결과 처리는 onMoveTask와 같다
  onMoveEvent?: (id: string, date: string) => Promise<boolean> | void;
  // 칸의 + 버튼. 없으면 + 버튼을 그리지 않는다
  onAddTask?: (dateIso: string) => void;
};

// 월 보기에서 칸마다 보이는 항목 수. 나머지는 "+n개 더"
const MAX_PER_DAY = 3;
// 작은 화면 칸의 점 개수
const MAX_DOTS = 4;
const EVENT_PREFIX = "ev:";

// seoulDay가 만든 UTC 자정 시각을 읽으므로 UTC로 포맷한다
const dayLabelFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const monthDayFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });

const dayLabel = (iso: string) => dayLabelFmt.format(new Date(seoulDay(iso)));
const monthDay = (iso: string) => monthDayFmt.format(new Date(seoulDay(iso)));

type Day = { events: CalendarEvent[]; tasks: TaskItem[] };

function eventText(e: CalendarEvent) {
  return e.time ? `${e.time} ${e.title}` : e.title;
}

export function MonthCalendar({
  items,
  events = [],
  anchor,
  mode = "month",
  todayIso,
  onOpenTask,
  onMoveTask,
  onMoveEvent,
  onAddTask,
}: MonthCalendarProps) {
  const weeks = useMemo(() => (mode === "week" ? [weekOf(anchor)] : monthGrid(anchor)), [anchor, mode]);
  const visible = useMemo(() => weeks.flat(), [weeks]);
  const month = monthOf(anchor);
  // 같은 화면에 캘린더가 둘 이상 있어도 안내 문장 id가 겹치지 않게 한다
  const hintId = useId();

  const byDay = useMemo(() => {
    const map = new Map<string, Day>();
    const at = (iso: string) => map.get(iso) ?? map.set(iso, { events: [], tasks: [] }).get(iso)!;
    // 종일 일정이 먼저, 그다음 시각 순
    for (const e of [...events].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))) at(e.date).events.push(e);
    for (const t of items) if (t.due_date) at(t.due_date).tasks.push(t);
    return map;
  }, [items, events]);

  // ─── 드래그. 칸마다 data-drop-group={날짜}라 놓은 묶음이 곧 새 날짜다 ───
  const moveTo = (id: string, date: string, viaKeyboard = false) => {
    if (id.startsWith(EVENT_PREFIX)) {
      const ev = events.find((e) => e.id === id.slice(EVENT_PREFIX.length));
      if (!ev || ev.date === date || !onMoveEvent) return;
      void Promise.resolve(onMoveEvent(ev.id, date)).then(
        (ok) => ok && announce(`일정 ${ev.title}을(를) ${monthDay(date)}로 옮겼습니다`),
      );
      return;
    }
    const t = items.find((x) => x.id === id);
    if (!t?.due_date || t.due_date === date || !onMoveTask) return;
    const patch = moveKeepingSpan({ start: t.start_date, due: t.due_date }, date);
    // 실패 안내는 호출한 쪽(작업 store의 토스트)이 한다
    void Promise.resolve(onMoveTask(t.id, patch)).then(
      (ok) =>
        ok &&
        announce(
          `${t.key} 작업 기한을 ${monthDay(date)}로 옮겼습니다${viaKeyboard ? "" : patch.start ? `. 시작일은 ${monthDay(patch.start)}` : ""}`,
        ),
    );
  };
  // 사이드바 프로젝트 목록 같은 다른 묶음 위에 놓으면 날짜가 아니므로 무시한다
  const { dragId, target, onPointerDown } = useTaskDrag(
    (id: string, t: DropTarget) => /^\d{4}-\d{2}-\d{2}$/.test(t.group) && moveTo(id, t.group),
  );
  const canDragTask = !!onMoveTask;
  const canDragEvent = !!onMoveEvent;

  // ─── 키보드. 날짜 버튼 하나만 Tab 순서에 두고 화살표로 옮긴다 ───
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const rovingDay = focusDay && visible.includes(focusDay) ? focusDay : visible.includes(todayIso) ? todayIso : visible.find((d) => monthOf(d) === month) ?? visible[0];
  const gridRef = useRef<HTMLDivElement>(null);
  const keyMoved = useRef(false);
  useEffect(() => {
    if (!keyMoved.current) return;
    keyMoved.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day-btn="${rovingDay}"]`)?.focus();
  }, [rovingDay]);

  const onDayKey = (e: React.KeyboardEvent, iso: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let next: string | null = null;
    if (step !== undefined) next = addDays(iso, step);
    else if (e.key === "Home") next = addDays(iso, -weekdayIndex(iso));
    else if (e.key === "End") next = addDays(iso, 6 - weekdayIndex(iso));
    if (!next) return;
    e.preventDefault();
    if (!visible.includes(next)) return;
    keyMoved.current = true;
    setFocusDay(next);
  };

  // ─── 그 날 항목 목록(+n개 더, Enter, 작은 화면 탭) ───
  const [openDay, setOpenDay] = useState<string | null>(null);
  const refocusItem = useRef<string | null>(null);
  const moveByKey = (e: React.KeyboardEvent, t: TaskItem) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !t.due_date || !onMoveTask || !t.canEdit) return;
    e.preventDefault();
    const date = addDays(t.due_date, e.key === "ArrowLeft" ? -1 : 1);
    moveTo(t.id, date, true);
    // 목록을 옮긴 날로 따라가 다시 누를 수 있게 한다. 보이는 범위를 벗어나면 닫는다
    if (visible.includes(date)) {
      refocusItem.current = t.id;
      setFocusDay(date);
      setOpenDay(date);
    } else {
      setOpenDay(null);
    }
  };

  return (
    <div className="px-(--gutter) pb-(--s-6)">
      <p id={hintId} className="sr-only">
        화살표로 날짜를 옮기고 Enter로 그 날 항목을 엽니다. 항목 목록에서 Alt+좌우 화살표로 작업 기한을 하루씩 옮깁니다.
      </p>
      <div
        ref={gridRef}
        role="grid"
        aria-label={mode === "week" ? `${monthDay(weeks[0][0])} 주 캘린더` : `${formatMonthTitle(anchor)} 캘린더`}
        aria-describedby={hintId}
        className="overflow-hidden rounded-(--r-lg) border border-(--border) bg-(--surface)"
      >
        <div role="row" className="grid grid-cols-7 border-b border-(--border) bg-(--surface-2)">
          {WEEKDAY_SHORT_LABELS.map((w, i) => (
            <div
              key={w}
              role="columnheader"
              className={cn(
                "px-2 py-1.5 text-(length:--fs-2xs) font-medium text-(--text-3)",
                i >= 5 && "text-(--text-4)",
              )}
            >
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 border-b border-(--divider) last:border-b-0">
            {week.map((iso, di) => {
              const day = byDay.get(iso) ?? { events: [], tasks: [] };
              const total = day.events.length + day.tasks.length;
              const outside = mode === "month" && monthOf(iso) !== month;
              const isToday = iso === todayIso;
              const limit = mode === "week" ? Infinity : MAX_PER_DAY;
              const shownEvents = day.events.slice(0, limit);
              const shownTasks = day.tasks.slice(0, Math.max(0, limit - shownEvents.length));
              const hidden = total - shownEvents.length - shownTasks.length;
              const label = [
                dayLabel(iso),
                isToday ? "오늘" : null,
                day.tasks.length ? `작업 ${day.tasks.length}개` : null,
                day.events.length ? `일정 ${day.events.length}개` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <Popover
                  key={iso}
                  open={openDay === iso}
                  // 닫히는 애니메이션 중인 이전 날짜 목록이 늦게 닫힘을 알려도 새로 연 목록은 닫지 않는다
                  onOpenChange={(o) => setOpenDay((cur) => (o ? iso : cur === iso ? null : cur))}
                >
                  <PopoverAnchor asChild>
                    <div
                      role="gridcell"
                      data-drop-group={canDragTask || canDragEvent ? iso : undefined}
                      className={cn(
                        "group/cell relative flex min-w-0 flex-col gap-0.5 p-1 transition-colors duration-(--dur)",
                        di < 6 && "border-r border-(--divider)",
                        mode === "week" ? "min-h-72 max-[640px]:min-h-24" : "min-h-28 max-[640px]:min-h-14",
                        di >= 5 && "bg-(--sunken)",
                        outside && "bg-(--sunken)",
                        target?.group === iso && "bg-(--accent-soft) ring-2 ring-(--accent) ring-inset",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-day-btn={iso}
                          tabIndex={iso === rovingDay ? 0 : -1}
                          aria-label={label}
                          aria-current={isToday ? "date" : undefined}
                          aria-haspopup="dialog"
                          aria-expanded={openDay === iso}
                          onFocus={() => setFocusDay(iso)}
                          onKeyDown={(e) => onDayKey(e, iso)}
                          onClick={() => setOpenDay(iso)}
                          className={cn(
                            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-(length:--fs-xs) tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                            // 작은 화면은 칸 전체가 날짜 버튼처럼 눌린다
                            "max-[640px]:after:absolute max-[640px]:after:inset-0",
                            isToday
                              ? "bg-(--accent) font-semibold text-(--on-accent)"
                              : outside
                                ? "text-(--text-4) hover:bg-(--surface-2)"
                                : "text-(--text-2) hover:bg-(--surface-2)",
                          )}
                        >
                          {Number(iso.slice(8))}
                        </button>
                        {onAddTask && (
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`${monthDay(iso)}에 새 작업`}
                            onClick={() => onAddTask(iso)}
                            className="hide-m ml-auto inline-flex size-5 items-center justify-center rounded-(--r-xs) text-(--text-3) opacity-0 group-hover/cell:opacity-100 hover:bg-(--surface-3) hover:text-(--text)"
                          >
                            <Plus aria-hidden size={13} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>

                      <ul className="hide-m flex min-w-0 flex-col gap-0.5">
                        {shownEvents.map((e) => (
                          <li
                            key={e.id}
                            data-drag-id={canDragEvent ? `${EVENT_PREFIX}${e.id}` : undefined}
                            title={`${e.project.name} · ${eventText(e)}`}
                            onPointerDown={canDragEvent ? (pe) => onPointerDown(pe, `${EVENT_PREFIX}${e.id}`) : undefined}
                            className={cn(
                              "flex min-w-0 items-center gap-1 rounded-(--r-xs) border border-dashed border-(--border-strong) bg-(--surface) px-1.5 py-0.5 text-(length:--fs-2xs) text-(--text-2) select-none",
                              canDragEvent && "cursor-grab",
                              dragId === `${EVENT_PREFIX}${e.id}` && "opacity-40",
                            )}
                          >
                            {e.time && <span className="shrink-0 font-medium tabular-nums text-(--text)">{e.time}</span>}
                            <span className="truncate">{e.title}</span>
                          </li>
                        ))}
                        {shownTasks.map((t) => (
                          <li key={t.id}>
                            <TaskChip
                              t={t}
                              draggable={canDragTask && t.canEdit}
                              dragging={dragId === t.id}
                              onPointerDown={onPointerDown}
                              onOpen={() => onOpenTask(t.key)}
                            />
                          </li>
                        ))}
                      </ul>
                      {hidden > 0 && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setOpenDay(iso)}
                          className="hide-m self-start rounded-(--r-xs) px-1.5 text-(length:--fs-2xs) font-medium text-(--text-3) hover:bg-(--surface-2) hover:text-(--text)"
                        >
                          +{hidden}개 더
                        </button>
                      )}
                      {total > 0 && (
                        <div aria-hidden className="only-m flex flex-wrap gap-0.5 px-1">
                          {[...day.events.map((e) => e.project.color), ...day.tasks.map((t) => t.project.color)]
                            .slice(0, MAX_DOTS)
                            .map((c, i) => (
                              <span key={i} className="size-1.5 rounded-full" style={{ background: colorHex(c) }} />
                            ))}
                        </div>
                      )}
                    </div>
                  </PopoverAnchor>
                  {openDay === iso && (
                    <PopoverContent
                      align="start"
                      collisionPadding={16}
                      aria-label={`${dayLabel(iso)} 항목`}
                      className="w-72 max-w-[calc(100vw-32px)] gap-2 rounded-(--r) bg-(--surface) p-(--s-2) text-(--text) shadow-(--shadow-pop) ring-0"
                      onOpenAutoFocus={(e) => {
                        const id = refocusItem.current;
                        if (!id) return;
                        e.preventDefault();
                        requestAnimationFrame(() => {
                          document.querySelector<HTMLElement>(`[data-cal-item="${id}"]`)?.focus();
                          refocusItem.current = null;
                        });
                      }}
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        // 키보드 이동으로 옆 날짜 목록이 열려 있거나 바깥을 눌러 다른 요소로 포커스가 갔으면 빼앗지 않는다.
                        // 닫히는 목록은 애니메이션이 끝난 뒤에야 이 콜백을 부른다
                        if (refocusItem.current) return;
                        const active = document.activeElement;
                        if (active?.closest("[data-slot=popover-content][data-state=open]")) return;
                        if (active && active !== document.body && !active.closest("[data-slot=popover-content]")) return;
                        gridRef.current?.querySelector<HTMLElement>(`[data-day-btn="${rovingDay}"]`)?.focus();
                      }}
                    >
                      <DayList
                        iso={iso}
                        day={day}
                        hintId={hintId}
                        onAdd={
                          onAddTask &&
                          (() => {
                            setOpenDay(null);
                            onAddTask(iso);
                          })
                        }
                        onOpen={(t) => {
                          setOpenDay(null);
                          onOpenTask(t.key);
                        }}
                        onKeyMove={moveByKey}
                      />
                    </PopoverContent>
                  )}
                </Popover>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskChip({
  t,
  draggable,
  dragging,
  onPointerDown,
  onOpen,
}: {
  t: TaskItem;
  draggable: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  onOpen: () => void;
}) {
  const done = t.status === "done";
  return (
    // 키보드는 날짜 목록(Enter)으로 다루므로 칸 안의 작업은 Tab 순서에서 뺀다.
    // 끌기 훅이 button 위에서는 드래그를 시작하지 않아 div에 role=button을 준다
    <div
      role="button"
      tabIndex={-1}
      data-drag-id={draggable ? t.id : undefined}
      title={`${t.key} ${t.title}`}
      onPointerDown={draggable ? (e) => onPointerDown(e, t.id) : undefined}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-(--r-xs) bg-(--surface-2) px-1.5 py-0.5 text-(length:--fs-2xs) select-none [-webkit-touch-callout:none] hover:bg-(--surface-3)",
        draggable ? "cursor-grab" : "cursor-pointer",
        dragging && "opacity-40",
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: colorHex(t.project.color) }} />
      <span className={cn("truncate", done ? "text-(--text-4) line-through" : "text-(--text)")}>{t.title}</span>
    </div>
  );
}

function DayList({
  iso,
  day,
  hintId,
  onAdd,
  onOpen,
  onKeyMove,
}: {
  iso: string;
  day: Day;
  hintId: string;
  onAdd?: () => void;
  onOpen: (t: TaskItem) => void;
  onKeyMove: (e: React.KeyboardEvent, t: TaskItem) => void;
}) {
  const empty = day.events.length + day.tasks.length === 0;
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-(length:--fs-sm) font-medium text-(--text)">{dayLabel(iso)}</p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-(--h-xs) items-center gap-1 rounded-(--r-xs) px-1.5 text-(length:--fs-xs) text-(--text-3) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <Plus aria-hidden size={12} strokeWidth={1.8} />새 작업
          </button>
        )}
      </div>
      {empty ? (
        <p className="px-1 py-2 text-(length:--fs-sm) text-(--text-3)">예정된 일정이 없습니다</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {day.events.map((e) => (
            <li
              key={e.id}
              className="flex min-w-0 items-center gap-1.5 rounded-(--r-xs) border border-dashed border-(--border-strong) px-2 py-1 text-(length:--fs-xs) text-(--text-2)"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: colorHex(e.project.color) }} />
              {e.time && <span className="shrink-0 font-medium tabular-nums text-(--text)">{e.time}</span>}
              <span className="truncate">{e.title}</span>
              <span className="ml-auto shrink-0 truncate text-(--text-4)">{e.project.name}</span>
            </li>
          ))}
          {day.tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                data-cal-item={t.id}
                aria-describedby={hintId}
                onClick={() => onOpen(t)}
                onKeyDown={(e) => onKeyMove(e, t)}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-(--r-xs) px-2 py-1 text-left text-(length:--fs-xs) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
              >
                <StatusIcon status={t.status} size={12} />
                <span className={cn("truncate", t.status === "done" ? "text-(--text-4) line-through" : "text-(--text)")}>
                  {t.title}
                </span>
                <span className="ml-auto shrink-0 font-mono text-(length:--fs-2xs) text-(--text-4)">{t.key}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
