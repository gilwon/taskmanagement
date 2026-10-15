"use client";
// 캘린더 화면 본문. 뷰 상태(필터·검색·완료 표시)를 적용한 작업과 일정을 월·주 그리드에 그리고,
// 작업 이동은 작업 store로(낙관적 갱신·실패 시 되돌림은 store가 한다), 일정 이동은 일정 Server Action으로 보낸다
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarNav } from "@/components/schedule/calendar-nav";
import { MonthCalendar } from "@/components/schedule/month-calendar";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useNewTask } from "@/components/tasks/new-task";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { FilterChipBar, TaskToolbar, useViewState } from "@/components/tasks/toolbar";
import { moveEvent } from "@/lib/schedule/actions";
import type { CalendarEvent, CalendarMode } from "@/lib/schedule/types";
import type { ViewKey, ViewState } from "@/lib/tasks/types";
import { applyView } from "@/lib/tasks/view";

export function CalendarView({
  viewKey,
  initialState,
  events: initialEvents,
  anchor,
  mode,
  todayIso,
  nowIso,
  legend,
  projectId,
  canEdit = true,
}: {
  viewKey: ViewKey;
  initialState: ViewState;
  events: CalendarEvent[];
  anchor: string;
  mode: CalendarMode;
  todayIso: string;
  nowIso: string;
  legend?: { id: string; name: string; color: string }[];
  // 프로젝트 탭이면 그 프로젝트 id. 드로어가 잠시 빌려 넣은 다른 프로젝트 작업을 빼고, 새 작업 기본 프로젝트로 쓴다
  projectId?: string;
  // 프로젝트 탭에서 그 프로젝트 편집 권한이 없으면 false. + 버튼과 일정 끌기를 숨긴다(작업 끌기는 작업마다 canEdit로 판단)
  canEdit?: boolean;
}) {
  const { items: storeItems, workspace } = useTasks();
  const actions = useTaskActions();
  const { open } = useTaskDrawer();
  const { openNewTask } = useNewTask();
  const [state, setState] = useViewState(workspace.id, viewKey, initialState);
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const items = useMemo(() => {
    const scoped = projectId ? storeItems.filter((t) => t.project_id === projectId) : storeItems;
    return applyView(scoped, { ...state, group: "none" }, { now }).flatMap((g) => g.items);
  }, [storeItems, projectId, state, now]);

  // 일정은 store 밖이라 여기서 낙관적으로 바꾸고 실패하면 되돌린다. 서버가 새 목록을 주면 그 값으로 맞춘다
  const [events, setEvents] = useState(initialEvents);
  const [prevInitial, setPrevInitial] = useState(initialEvents);
  if (prevInitial !== initialEvents) {
    setPrevInitial(initialEvents);
    setEvents(initialEvents);
  }
  // 프로젝트 필터는 일정에도 적용한다. 다른 필터(상태·담당자 등)는 일정에 없는 값이라 보지 않는다
  const visibleEvents = useMemo(
    () =>
      events.filter((e) =>
        state.filters.every(
          (f) => f.f !== "project" || f.v.length === 0 || f.v.includes(e.project.id) === (f.op === "is"),
        ),
      ),
    [events, state.filters],
  );

  const onMoveEvent = async (id: string, date: string) => {
    const before = events.find((e) => e.id === id);
    if (!before) return false;
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, date } : e)));
    const r = await moveEvent(id, date);
    if (!r.ok) {
      setEvents((list) => list.map((e) => (e.id === id ? before : e)));
      toast.error(r.error);
      return false;
    }
    return true;
  };

  return (
    <>
      <div className="px-(--gutter) pb-(--s-2)">
        <TaskToolbar state={state} onChange={setState} showColumns={false} showGroup={false} />
        <FilterChipBar state={state} onChange={setState} />
      </div>
      <CalendarNav anchor={anchor} mode={mode} todayIso={todayIso} legend={legend} />
      <MonthCalendar
        items={items}
        events={visibleEvents}
        anchor={anchor}
        mode={mode}
        todayIso={todayIso}
        onOpenTask={open}
        onMoveTask={(id, patch) => actions.update(id, patch)}
        onMoveEvent={canEdit ? onMoveEvent : undefined}
        onAddTask={canEdit ? (due) => openNewTask(projectId ? { due, projectId } : { due }) : undefined}
      />
      <TaskDrawerHost />
    </>
  );
}
