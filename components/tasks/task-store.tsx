"use client";
// 화면의 작업 목록 store. 낙관적으로 바꾼 뒤 Server Action 결과로 확정하고, 실패하면 되돌리고 오류 토스트를 띄운다.
// 목록과 드로어가 같은 store를 보므로 한쪽 편집이 다른 쪽에 바로 보인다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import {
  bulkDelete,
  bulkRestore,
  bulkUpdate as bulkUpdateAction,
  completeTask,
  createTask,
  deleteTask,
  moveTask,
  reopenTask,
  restoreTask,
  updateTask,
} from "@/lib/tasks/actions";
import type {
  BulkPatch,
  CreateTaskInput,
  TaskItem,
  TaskPatch,
  TaskStatus,
  WorkspaceMember,
} from "@/lib/tasks/types";

export type StoreWorkspace = { id: string; slug: string; name: string };

type TaskData = {
  items: TaskItem[];
  workspace: StoreWorkspace;
  members: WorkspaceMember[];
  labels: string[];
  // 로그인한 사용자 id(새 작업 기본 담당자 등)
  meId: string;
};

// 모든 비동기 동작은 성공 여부를 돌려준다. 실패 안내(토스트)는 store가 띄운다
type TaskActions = {
  create: (input: CreateTaskInput) => Promise<TaskItem | null>;
  update: (id: string, patch: TaskPatch) => Promise<boolean>;
  move: (id: string, status: TaskStatus, sortOrder?: number) => Promise<boolean>;
  complete: (id: string) => Promise<boolean>;
  reopen: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  bulkUpdate: (ids: string[], patch: BulkPatch) => Promise<boolean>;
  bulkRemove: (ids: string[]) => Promise<boolean>;
  // 서버 왕복 없이 store만 고친다(서브태스크 수 갱신, 다른 액션 결과 반영 등)
  upsertLocal: (item: TaskItem) => void;
  patchLocal: (id: string, partial: Partial<TaskItem>) => void;
  removeLocal: (id: string) => void;
};

const DataContext = createContext<TaskData | null>(null);
const ActionsContext = createContext<TaskActions | null>(null);

// 반복 회차 예약일. "10월 26일"
const nextDateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });

function nextMessage(next: TaskItem) {
  if (!next.due_date) return `다음 “${next.title}” 작업을 만들었습니다`;
  return `다음 “${next.title}” 작업이 ${nextDateFmt.format(new Date(`${next.due_date}T00:00:00Z`))}에 예약되었습니다`;
}

function replaceOrAppend(list: TaskItem[], item: TaskItem) {
  return list.some((t) => t.id === item.id) ? list.map((t) => (t.id === item.id ? item : t)) : [...list, item];
}

type Props = {
  initialItems: TaskItem[];
  workspace: StoreWorkspace;
  members: WorkspaceMember[];
  labels: string[];
  meId: string;
  children: React.ReactNode;
};

// 워크스페이스가 바뀌면 store를 새로 만든다(spec R17). 다른 워크스페이스 작업이 섞이지 않는다
export function TaskStoreProvider(props: Props) {
  return <Store key={props.workspace.id} {...props} />;
}

function Store({ initialItems, workspace, members, labels, meId, children }: Props) {
  const [items, setItems] = useState(initialItems);
  // 서버가 새 목록을 내려 주면(router.refresh 등) 낙관적 상태를 버리고 서버 값으로 맞춘다
  const [prevInitial, setPrevInitial] = useState(initialItems);
  if (prevInitial !== initialItems) {
    setPrevInitial(initialItems);
    setItems(initialItems);
  }

  // 되돌리기용 현재 목록. 이벤트 처리 중에 읽는다
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const upsertLocal = useCallback((item: TaskItem) => setItems((list) => replaceOrAppend(list, item)), []);
  const patchLocal = useCallback(
    (id: string, partial: Partial<TaskItem>) =>
      setItems((list) => list.map((t) => (t.id === id ? { ...t, ...partial } : t))),
    [],
  );
  const removeLocal = useCallback((id: string) => setItems((list) => list.filter((t) => t.id !== id)), []);

  // 실패 시 되돌린다. 삭제됐던 항목은 다시 넣는다
  const revert = useCallback((snapshots: TaskItem[], error: string) => {
    setItems((list) => snapshots.reduce(replaceOrAppend, list));
    toast.error(error);
  }, []);

  const actions = useMemo<TaskActions>(() => {
    const find = (id: string) => itemsRef.current.find((t) => t.id === id);
    const assigneeOf = (id: string | null): TaskItem["assignee"] => {
      if (!id) return null;
      const m = membersRef.current.find((x) => x.id === id);
      return { id, name: m?.name ?? UNKNOWN_USER_LABEL, color: m?.color ?? "slate" };
    };

    // TaskPatch를 화면 필드로 옮긴다(낙관적 갱신용)
    const optimistic = (t: TaskItem, patch: TaskPatch): TaskItem => ({
      ...t,
      ...(patch.title !== undefined && { title: patch.title.trim() }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.assigneeId !== undefined && {
        assignee_id: patch.assigneeId,
        assignee: assigneeOf(patch.assigneeId),
      }),
      ...(patch.start !== undefined && { start_date: patch.start }),
      ...(patch.due !== undefined && { due_date: patch.due }),
      ...(patch.labels !== undefined && { labels: patch.labels }),
      ...(patch.estimate !== undefined && { estimate: patch.estimate }),
      ...(patch.recur !== undefined && { recur: patch.recur }),
      // 설명은 정제 전 값을 store에 두지 않는다. 서버가 정제한 값으로만 바꾼다(spec R13)
      ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
    });

    const settleComplete = (item: TaskItem, next: TaskItem | null) => {
      setItems((list) => (next ? replaceOrAppend(replaceOrAppend(list, item), next) : replaceOrAppend(list, item)));
      if (next) toast.success(nextMessage(next));
    };

    const restoreOne = async (id: string, token: string) => {
      const r = await restoreTask(id, token);
      if (!r.ok) return void toast.error(r.error);
      setItems((list) => replaceOrAppend(list, r.data));
      toast.success("작업을 되돌렸습니다");
    };

    return {
      upsertLocal,
      patchLocal,
      removeLocal,

      async create(input) {
        const r = await createTask(input);
        if (!r.ok) {
          toast.error(r.error);
          return null;
        }
        setItems((list) => replaceOrAppend(list, r.data));
        return r.data;
      },

      async update(id, patch) {
        const before = find(id);
        if (!before) return false;
        // 보관하면 목록에서 빠진다(서버 목록 조회와 같은 기준)
        if (patch.archived) setItems((list) => list.filter((t) => t.id !== id));
        else setItems((list) => list.map((t) => (t.id === id ? optimistic(t, patch) : t)));
        const r = await updateTask(id, patch);
        if (!r.ok) {
          revert([before], r.error);
          return false;
        }
        if (!r.data.archived_at) setItems((list) => replaceOrAppend(list, r.data));
        return true;
      },

      async move(id, status, sortOrder) {
        const before = find(id);
        if (!before) return false;
        setItems((list) =>
          list.map((t) => (t.id === id ? { ...t, status, sort_order: sortOrder ?? t.sort_order } : t)),
        );
        const r = await moveTask(id, status, sortOrder);
        if (!r.ok) {
          revert([before], r.error);
          return false;
        }
        settleComplete(r.data.item, r.data.next);
        return true;
      },

      async complete(id) {
        const before = find(id);
        if (!before) return false;
        setItems((list) => list.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
        const r = await completeTask(id);
        if (!r.ok) {
          revert([before], r.error);
          return false;
        }
        settleComplete(r.data.item, r.data.next);
        return true;
      },

      async reopen(id) {
        const before = find(id);
        if (!before) return false;
        setItems((list) =>
          list.map((t) => (t.id === id ? { ...t, status: t.prev_status ?? "todo", completed_at: null } : t)),
        );
        const r = await reopenTask(id);
        if (!r.ok) {
          revert([before], r.error);
          return false;
        }
        setItems((list) => replaceOrAppend(list, r.data));
        return true;
      },

      // 소프트 삭제. 토스트의 실행 취소는 받은 토큰을 그대로 넘겨 그 작업만 복원한다
      async remove(id) {
        const before = find(id);
        if (!before) return false;
        setItems((list) => list.filter((t) => t.id !== id));
        const r = await deleteTask(id);
        if (!r.ok) {
          revert([before], r.error);
          return false;
        }
        const { token } = r.data;
        toast("작업을 삭제했습니다", {
          action: { label: "실행 취소", onClick: () => void restoreOne(id, token) },
        });
        return true;
      },

      async bulkUpdate(ids, patch) {
        const before = ids.map(find).filter((t): t is TaskItem => !!t);
        if (before.length === 0) return false;
        const set = new Set(ids);
        setItems((list) =>
          list.map((t) =>
            set.has(t.id)
              ? {
                  ...t,
                  ...(patch.status !== undefined && { status: patch.status }),
                  ...(patch.priority !== undefined && { priority: patch.priority }),
                  ...(patch.assigneeId !== undefined && {
                    assignee_id: patch.assigneeId,
                    assignee: assigneeOf(patch.assigneeId),
                  }),
                }
              : t,
          ),
        );
        const r = await bulkUpdateAction(ids, patch);
        if (!r.ok) {
          revert(before, r.error);
          return false;
        }
        const { updated, created, failedIds } = r.data;
        setItems((list) => [...updated, ...created].reduce(replaceOrAppend, list));
        for (const next of created) toast.success(nextMessage(next));
        if (failedIds.length > 0) {
          revert(
            before.filter((t) => failedIds.includes(t.id)),
            `작업 ${failedIds.length}개는 권한이 없거나 삭제되어 바꾸지 못했습니다.`,
          );
          return false;
        }
        return true;
      },

      async bulkRemove(ids) {
        const before = ids.map(find).filter((t): t is TaskItem => !!t);
        if (before.length === 0) return false;
        const set = new Set(ids);
        setItems((list) => list.filter((t) => !set.has(t.id)));
        const r = await bulkDelete(ids);
        if (!r.ok) {
          revert(before, r.error);
          return false;
        }
        const { tokens, failedIds } = r.data;
        if (failedIds.length > 0) {
          revert(
            before.filter((t) => failedIds.includes(t.id)),
            `작업 ${failedIds.length}개는 삭제하지 못했습니다.`,
          );
        }
        const count = Object.keys(tokens).length;
        toast(`작업 ${count}개를 삭제했습니다`, {
          action: {
            label: "실행 취소",
            onClick: async () => {
              const res = await bulkRestore(tokens);
              if (!res.ok) return void toast.error(res.error);
              const { restored, failedIds: notRestored, conflictIds, error } = res.data;
              setItems((list) => restored.reduce(replaceOrAppend, list));
              if (notRestored.length === 0) return void toast.success("작업을 되돌렸습니다");
              // 토큰 불일치(삭제 뒤 바뀜)와 그 밖의 실패(권한·네트워크)는 원인이 달라 문구를 나눈다
              if (conflictIds.length > 0) {
                toast.error(`작업 ${conflictIds.length}개는 삭제 후 바뀌어 되돌리지 못했습니다.`);
              }
              const others = notRestored.length - conflictIds.length;
              if (others > 0) toast.error(`작업 ${others}개를 되돌리지 못했습니다. ${error ?? ""}`.trim());
            },
          },
        });
        return failedIds.length === 0;
      },
    };
  }, [upsertLocal, patchLocal, removeLocal, revert]);

  const data = useMemo(
    () => ({ items, workspace, members, labels, meId }),
    [items, workspace, members, labels, meId],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={data}>{children}</DataContext.Provider>
    </ActionsContext.Provider>
  );
}

// store 밖에서도 쓰일 수 있는 부품용. provider가 없으면 null
export function useTasksOptional(): TaskData | null {
  return useContext(DataContext);
}

export function useTasks(): TaskData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useTasks는 TaskStoreProvider 안에서만 쓸 수 있습니다");
  return ctx;
}

export function useTaskActions(): TaskActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useTaskActions는 TaskStoreProvider 안에서만 쓸 수 있습니다");
  return ctx;
}
