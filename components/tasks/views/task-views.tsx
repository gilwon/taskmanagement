"use client";
// 작업 화면 본문. 뷰 상태를 읽어 applyView로 묶고 툴바·필터 칩바·목록/보드/표·bulk bar·드로어를 그린다.
// 드래그·키보드 이동, 인라인 생성, 다중 선택(Shift 범위·Esc 해제)을 여기서 처리해 세 뷰가 같은 규칙을 쓴다
import { SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { BulkBar, FilterChipBar, TaskToolbar, useViewState } from "@/components/tasks/toolbar";
import { BoardView } from "@/components/tasks/views/board-view";
import { useCurrentView } from "@/components/tasks/views/current-view";
import { ListView } from "@/components/tasks/views/list-view";
import { orderAt } from "@/components/tasks/views/order";
import { announce, refocus, type ViewCtl, type ViewProject } from "@/components/tasks/views/shared";
import { TableView } from "@/components/tasks/views/table-view";
import { seoulDay } from "@/lib/format/date";
import { NAV_LABELS } from "@/lib/i18n/labels";
import type {
  CreateTaskInput,
  GroupField,
  TaskGroup,
  TaskPriority,
  TaskStatus,
  ViewKey,
  ViewState,
} from "@/lib/tasks/types";
import { applyView } from "@/lib/tasks/view";

export type ViewMode = "list" | "board" | "table";
const MODES: readonly ViewMode[] = ["list", "board", "table"];

// 그룹 값을 직접 넣을 수 있는 묶음인지. 기한은 오늘·기한 없음만 값이 하나로 정해진다
function canAssign(field: GroupField, key: string) {
  if (field === "due") return key === "today" || key === "none";
  return true;
}

// 다른 묶음으로 끌어 옮길 수 있는지. 프로젝트는 DB가 막고(키가 프로젝트에 묶임), 그룹 없음은 묶음이 하나다
function canMoveAcross(field: GroupField, key: string) {
  return field !== "project" && field !== "none" && canAssign(field, key);
}

export function TaskViews({
  viewKey,
  initialState,
  mode: fixedMode,
  showProject,
  projects,
  projectId,
  nowIso,
}: {
  viewKey: ViewKey;
  initialState: ViewState;
  // 프로젝트 탭·저장 뷰는 모드가 정해져 있다. 없으면 ?view= 값으로 고르고 모드 전환을 보인다
  mode?: ViewMode;
  showProject: boolean;
  projects: ViewProject[];
  // 프로젝트 화면이면 그 프로젝트 id. 드로어가 잠시 빌려 넣은 다른 프로젝트 작업을 목록에서 뺀다
  projectId?: string;
  nowIso: string;
}) {
  const { items: storeItems, workspace } = useTasks();
  const items = useMemo(
    () => (projectId ? storeItems.filter((t) => t.project_id === projectId) : storeItems),
    [storeItems, projectId],
  );
  const actions = useTaskActions();
  const { openKey } = useTaskDrawer();
  const params = useSearchParams();
  const [state, setState] = useViewState(workspace.id, viewKey, initialState);
  // 프로젝트 헤더의 저장 뷰 만들기가 지금 화면 필터를 읽는다
  const currentViewRef = useCurrentView();
  useEffect(() => {
    if (currentViewRef) currentViewRef.current = state;
  }, [currentViewRef, state]);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const todayIso = useMemo(() => new Date(seoulDay(now)).toISOString().slice(0, 10), [now]);

  const urlMode = params.get("view");
  const mode: ViewMode = fixedMode ?? (MODES.includes(urlMode as ViewMode) ? (urlMode as ViewMode) : "list");
  // 모드 전환은 서버 왕복 없이 주소만 바꾼다. ?task= 등 다른 값은 그대로 둔다
  const setMode = (next: ViewMode) => {
    const q = new URLSearchParams(params.toString());
    if (next === "list") q.delete("view");
    else q.set("view", next);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
  };

  // 보드는 그룹 설정과 무관하게 항상 상태 열이다. 표는 묶지 않는다
  const groups = useMemo(
    () => applyView(items, mode === "list" ? state : { ...state, group: mode === "board" ? "status" : "none" }, { now }),
    [items, state, mode, now],
  );
  const visibleIds = useMemo(() => groups.flatMap((g) => g.items.map((t) => t.id)), [groups]);
  const visibleCount = visibleIds.length;

  // ─── 다중 선택 ───
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const select = useCallback(
    (id: string, { range }: { range: boolean }) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const a = anchor.current ? visibleIds.indexOf(anchor.current) : -1;
        const b = visibleIds.indexOf(id);
        if (range && a >= 0 && b >= 0) {
          for (const x of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      if (!range) anchor.current = id;
    },
    [visibleIds],
  );
  // 삭제·필터로 사라진 작업은 선택에서 뺀다
  const selectedIds = useMemo(() => [...selected].filter((id) => visibleIds.includes(id)), [selected, visibleIds]);
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, []);

  // Esc는 팝오버·메뉴·입력·드로어가 먼저 닫히고, 그 뒤에 선택을 푼다(META §6 순서)
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || openKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true], [role=dialog], [role=menu], [role=listbox]")) return;
      clearSelection();
      announce("선택을 해제했습니다");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedIds.length, openKey, clearSelection]);

  // ─── 이동 ───
  // 같은 묶음 안 순서는 sort_order만, 상태가 바뀌면 move(활동 기록), 그 밖의 그룹은 값과 순서를 한 번에 고친다
  const commit = useCallback(
    async (id: string, groupList: TaskGroup[], field: GroupField, toKey: string, index: number) => {
      const from = groupList.find((g) => g.items.some((t) => t.id === id));
      const to = groupList.find((g) => g.key === toKey);
      const task = from?.items.find((t) => t.id === id);
      if (!from || !to || !task) return;
      const same = from.key === to.key;
      if (same && from.items.findIndex((t) => t.id === id) === index) return;
      if (!same && !canMoveAcross(field, to.key)) {
        toast.error("이 묶음으로는 옮길 수 없습니다");
        return;
      }
      const others = to.items.filter((t) => t.id !== id);
      const manual = state.sort.f === "manual" && state.sort.dir === 1;
      // 다른 정렬로 보이는 중이면 화면 순서와 sort_order 순서가 달라 앞뒤 중간값이 엉뚱한 자리가 된다.
      // 이때는 화면에서 바로 위에 있던 작업의 수동 순서 바로 뒤에 놓는다
      let order: number;
      if (manual) {
        order = orderAt(others.map((t) => Number(t.sort_order)), index);
      } else {
        const byOrder = [...others].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        const above = others[index - 1];
        order = orderAt(
          byOrder.map((t) => Number(t.sort_order)),
          above ? byOrder.indexOf(above) + 1 : 0,
        );
      }
      if (!manual) {
        setState({ ...state, sort: { f: "manual", dir: 1 } });
        toast("직접 정렬로 바꿔 순서를 유지합니다");
      }
      let ok: boolean;
      if (same) ok = await actions.update(id, { sortOrder: order });
      else if (field === "status") ok = await actions.move(id, to.key as TaskStatus, order);
      else if (field === "priority") ok = await actions.update(id, { priority: to.key as TaskPriority, sortOrder: order });
      else if (field === "assignee")
        ok = await actions.update(id, { assigneeId: to.key === "none" ? null : to.key, sortOrder: order });
      else ok = await actions.update(id, { due: to.key === "today" ? todayIso : null, sortOrder: order });
      if (ok) announce(`${task.key} 작업을 ${to.label} ${index + 1}번째로 옮겼습니다`);
    },
    [actions, state, setState, todayIso],
  );

  const ctl: ViewCtl = {
    state,
    setState,
    now,
    showProject,
    projects,
    selected: new Set(selectedIds),
    select,
    canAssign,
    drop: (id, target, groupList, field) => void commit(id, groupList, field, target.group, target.index),
    keyMove: (e, id, groupList, field) => {
      if (!e.altKey) return;
      const gi = groupList.findIndex((g) => g.items.some((t) => t.id === id));
      const g = groupList[gi];
      if (!g) return;
      const i = g.items.findIndex((t) => t.id === id);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const ni = e.key === "ArrowUp" ? i - 1 : i + 1;
        if (ni < 0 || ni >= g.items.length) return;
        void commit(id, groupList, field, g.key, ni).then(() => refocus(id));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const to = groupList[e.key === "ArrowLeft" ? gi - 1 : gi + 1];
        if (!to) return;
        void commit(id, groupList, field, to.key, to.items.length);
        refocus(id);
      }
    },
    create: async (field, groupKey, title, projectId) => {
      const input: CreateTaskInput = { projectId, title };
      if (field === "status") input.status = groupKey as TaskStatus;
      else if (field === "priority") input.priority = groupKey as TaskPriority;
      else if (field === "assignee") input.assigneeId = groupKey === "none" ? null : groupKey;
      else if (field === "due" && groupKey === "today") input.due = todayIso;
      else if (field === "project") input.projectId = groupKey;
      const group = groups.find((g) => g.key === groupKey);
      const orders = (group?.items ?? []).map((t) => Number(t.sort_order));
      input.sortOrder = orders.length ? Math.max(...orders) + 1 : 1;
      const created = await actions.create(input);
      if (created) announce(`${created.key} 작업을 만들었습니다`);
      return !!created;
    },
  };

  const filtered = state.filters.some((f) => f.v.length > 0) || state.q.trim() !== "";
  const noResults = items.length > 0 && visibleCount === 0;

  return (
    <>
      <div className="px-(--gutter) pb-(--s-2)">
        <TaskToolbar state={state} onChange={setState} showColumns={mode === "table"} showGroup={mode === "list"}>
          {!fixedMode && (
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              spacing={0}
              value={mode}
              aria-label="보기 방식"
              onValueChange={(v) => v && setMode(v as ViewMode)}
            >
              {MODES.map((m) => (
                <ToggleGroupItem key={m} value={m} className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
                  {NAV_LABELS[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </TaskToolbar>
        <FilterChipBar state={state} onChange={setState} />
      </div>

      {noResults && mode !== "board" ? (
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
      ) : mode === "board" ? (
        <BoardView ctl={ctl} groups={groups} />
      ) : mode === "table" ? (
        <TableView ctl={ctl} items={groups[0]?.items ?? []} empty={items.length === 0} />
      ) : (
        <ListView ctl={ctl} groups={groups} empty={items.length === 0} />
      )}

      {selectedIds.length > 0 && <BulkBar selectedIds={selectedIds} onClear={clearSelection} />}
      <TaskDrawerHost />
    </>
  );
}
