"use client";
// 내 작업 화면 본문. 나에게 배정된 작업을 기한 지남·오늘·예정·완료(처음엔 접힘)로 묶어 보인다.
// 필터·검색·정렬은 공통 툴바를 쓰고 뷰 상태는 mytasks 키로 저장한다
import { ChevronRight, ListChecks, Plus, SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CompleteToggle } from "@/components/home/parts";
import { CalendarNav } from "@/components/schedule/calendar-nav";
import { MonthCalendar, type CalendarMode } from "@/components/schedule/month-calendar";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectIcon } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useNewTask } from "@/components/tasks/new-task";
import { DatePicker, DueLabel, PriorityIcon, PriorityPicker, TaskKey } from "@/components/tasks/parts";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { FilterChipBar, TaskToolbar, useViewState } from "@/components/tasks/toolbar";
import { cellBtn } from "@/components/tasks/views/list-view";
import { TaskMenu } from "@/components/tasks/views/shared";
import { byDue, myTaskBucket, type MyTaskBucket } from "@/lib/home/stats";
import { useFormatter, useT } from "@/lib/i18n/client";
import type { TaskItem, ViewState } from "@/lib/tasks/types";
import { applyView } from "@/lib/tasks/view";
import { cn } from "@/lib/utils";

// 보기 방식 이름은 common.nav.{list,calendar}다
const MODES = ["list", "calendar"] as const;
type Mode = (typeof MODES)[number];

const GROUPS = (["overdue", "today", "upcoming", "done"] as const).map((key) => ({ key }));

function Row({ t, now }: { t: TaskItem; now: Date }) {
  // 작업 prop이 t라서 번역 함수는 tr로 부른다
  const tr = useT();
  const f = useFormatter();
  const { open } = useTaskDrawer();
  const { update } = useTaskActions();
  const done = t.status === "done";
  return (
    <li className="group/row flex h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--gutter) hover:bg-(--surface-2) max-[640px]:gap-1.5">
      <CompleteToggle task={t} />
      <TaskKey value={t.key} className="hide-m w-16" />
      <button
        type="button"
        onClick={() => open(t.key)}
        className={cn(
          "min-w-0 flex-1 truncate rounded-(--r-xs) text-left text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)",
          done && "text-(--text-3) line-through",
        )}
      >
        {t.title}
      </button>
      <span className="flex w-36 shrink-0 items-center gap-1.5 truncate text-(length:--fs-sm) text-(--text-3) max-[901px]:hidden">
        <ProjectIcon icon={t.project.icon} color={t.project.color} size={16} />
        <span className="truncate">{t.project.name}</span>
      </span>
      <PriorityPicker value={t.priority} onChange={(p) => p && p !== t.priority && void update(t.id, { priority: p })}>
        <button
          type="button"
          aria-label={tr(t.priority === "none" ? "schedule.myTasks.priorityNone" : "schedule.myTasks.priority", {
            label: tr(`common.taskPriority.${t.priority}`),
          })}
          className={cn(cellBtn, "hide-m")}
        >
          <PriorityIcon priority={t.priority} size={14} />
        </button>
      </PriorityPicker>
      <DatePicker label={tr("schedule.myTasks.due")} value={t.due_date} onChange={(d) => d !== t.due_date && void update(t.id, { due: d })}>
        <button
          type="button"
          aria-label={
            t.due_date ? tr("schedule.myTasks.dueValue", { due: f.due(t.due_date, now) }) : tr("schedule.myTasks.dueNone")
          }
          className={cn(cellBtn, "w-20 justify-start text-(length:--fs-sm) max-[640px]:w-14")}
        >
          {t.due_date ? (
            <DueLabel due={t.due_date} done={done} now={now} />
          ) : (
            <span className="truncate text-(--text-4)">{tr("schedule.myTasks.setDate")}</span>
          )}
        </button>
      </DatePicker>
      <TaskMenu task={t} />
    </li>
  );
}

export function MyTasksView({
  initialState,
  nowIso,
  calendar,
}: {
  initialState: ViewState;
  nowIso: string;
  // 캘린더 모드가 보는 범위(?m=·?w=)와 서울 기준 오늘
  calendar: { anchor: string; mode: CalendarMode; todayIso: string };
}) {
  const t = useT();
  const { items, workspace, meId } = useTasks();
  const { openNewTask } = useNewTask();
  const { open } = useTaskDrawer();
  const { update } = useTaskActions();
  const params = useSearchParams();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [state, setState] = useViewState(workspace.id, "mytasks", initialState);
  // 완료 묶음은 접힌 상태로 시작한다
  const [collapsed, setCollapsed] = useState<ReadonlySet<MyTaskBucket>>(new Set(["done"]));

  const urlMode = params.get("view");
  const mode: Mode = MODES.includes(urlMode as Mode) ? (urlMode as Mode) : "list";
  // 모드 전환은 서버 왕복 없이 주소만 바꾼다. ?task= 등 다른 값은 그대로 둔다
  const setMode = (next: Mode) => {
    const q = new URLSearchParams(params.toString());
    if (next === "list") q.delete("view");
    else q.set("view", next);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  };

  // 담당자가 바뀌면 바로 빠지도록 store에서 거른다. 드로어가 빌려 넣은 남의 작업도 섞이지 않는다
  const mine = useMemo(() => items.filter((task) => task.assignee_id === meId), [items, meId]);
  const counts = useMemo(() => {
    const c: Record<MyTaskBucket, number> = { overdue: 0, today: 0, upcoming: 0, done: 0 };
    for (const task of mine) c[myTaskBucket(task, now)] += 1;
    return c;
  }, [mine, now]);

  const visible = useMemo(() => applyView(mine, { ...state, group: "none" }, { now })[0]?.items ?? [], [mine, state, now]);
  const groups = useMemo(() => {
    // 수동 정렬이면 기한 순으로 보인다. 여러 프로젝트의 수동 순서는 서로 비교할 뜻이 없다
    const sorted = state.sort.f === "manual" ? [...visible].sort(byDue) : visible;
    return GROUPS.map((g) => ({ ...g, items: sorted.filter((task) => myTaskBucket(task, now) === g.key) })).filter(
      (g) => g.items.length > 0,
    );
  }, [visible, state.sort.f, now]);

  const filtered = state.filters.some((f) => f.v.length > 0) || state.q.trim() !== "";
  const toggle = (key: MyTaskBucket) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <PageHeader
        title={t("common.nav.myTasks")}
        subtitle={t("schedule.myTasks.subtitle", { today: counts.today, overdue: counts.overdue, upcoming: counts.upcoming })}
        actions={
          <Button size="sm" onClick={() => openNewTask()}>
            <Plus aria-hidden strokeWidth={1.8} />
            {t("common.nav.newTask")}
          </Button>
        }
      />
      <div className="px-(--gutter) pb-(--s-2)">
        <TaskToolbar state={state} onChange={setState} showColumns={false} showGroup={false}>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={mode}
            aria-label={t("schedule.myTasks.viewMode")}
            onValueChange={(v) => v && setMode(v as Mode)}
          >
            {MODES.map((m) => (
              <ToggleGroupItem key={m} value={m} className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
                {t(`common.nav.${m}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </TaskToolbar>
        <FilterChipBar state={state} onChange={setState} />
      </div>

      {mode === "calendar" ? (
        <>
          <CalendarNav anchor={calendar.anchor} mode={calendar.mode} todayIso={calendar.todayIso} />
          <MonthCalendar
            items={visible}
            anchor={calendar.anchor}
            mode={calendar.mode}
            todayIso={calendar.todayIso}
            onOpenTask={open}
            onMoveTask={(id, patch) => update(id, patch)}
            onAddTask={(due) => openNewTask({ due })}
          />
        </>
      ) : mine.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t("schedule.myTasks.emptyTitle")}
          description={t("schedule.myTasks.emptyDescription")}
          action={
            <Button size="sm" onClick={() => openNewTask()}>
              <Plus aria-hidden strokeWidth={1.8} /> {t("schedule.myTasks.addTask")}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("schedule.noResults.title")}
          description={t("schedule.noResults.description")}
          action={
            filtered && (
              <Button size="sm" variant="outline" onClick={() => setState({ ...state, filters: [], q: "" })}>
                {t("schedule.noResults.clearFilters")}
              </Button>
            )
          }
        />
      ) : (
        <div className="pb-(--s-8)">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const headingId = `my-tasks-${g.key}`;
            return (
              <section key={g.key} aria-labelledby={headingId}>
                <div className="flex h-9 items-center border-b border-(--border) bg-(--bg) px-(--gutter)">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`${headingId}-list`}
                    onClick={() => toggle(g.key)}
                    className="-ml-1 flex h-(--h-sm) min-w-0 items-center gap-1.5 rounded-(--r-xs) px-1 outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
                  >
                    <ChevronRight
                      aria-hidden
                      size={14}
                      strokeWidth={1.8}
                      className={cn("text-(--text-3) transition-transform duration-(--dur)", !isCollapsed && "rotate-90")}
                    />
                    <h2
                      id={headingId}
                      className={cn(
                        "truncate text-(length:--fs-sm) font-semibold",
                        g.key === "overdue" ? "text-(--red)" : "text-(--text)",
                      )}
                    >
                      {t(`common.myTaskBucket.${g.key}`)}
                    </h2>
                    <span className="text-(length:--fs-xs) text-(--text-3)">{g.items.length}</span>
                  </button>
                </div>
                {!isCollapsed && (
                  <ul id={`${headingId}-list`}>
                    {g.items.map((task) => (
                      <Row key={task.id} t={task} now={now} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      <TaskDrawerHost />
    </>
  );
}
