"use client";
// 새 작업 모달 전역 실행기. 워크스페이스 레이아웃에 한 번 두고 useNewTask().openNewTask(defaults)로 연다.
// 화면에 작업 store가 있으면(useNewTaskTarget으로 등록) store로 만들어 바로 보이고, 없으면 Server Action으로 만든 뒤 화면을 새로 읽는다
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loadNewTaskOptions, type NewTaskOptions } from "@/components/tasks/new-task/actions";
import { NewTaskDialog, type NewTaskDefaults } from "@/components/tasks/new-task/new-task-dialog";
import { createSubtask, createTask } from "@/lib/tasks/actions";
import type { CreateTaskInput, TaskItem } from "@/lib/tasks/types";

// 현재 화면의 작업 store가 내주는 생성·열기. TaskDrawerHost가 등록한다
export type NewTaskTarget = {
  create: (input: CreateTaskInput) => Promise<TaskItem | null>;
  open: (key: string) => void;
};

type Ctx = {
  openNewTask: (defaults?: NewTaskDefaults) => void;
  setTarget: (target: NewTaskTarget | null) => void;
};

const LauncherContext = createContext<Ctx | null>(null);

export function useNewTask() {
  const ctx = useContext(LauncherContext);
  if (!ctx) throw new Error("useNewTask는 NewTaskLauncher 안에서만 쓸 수 있습니다");
  return { openNewTask: ctx.openNewTask };
}

// 화면의 store를 실행기에 등록한다. 실행기 밖(테스트 등)에서는 아무 일도 하지 않는다
export function useNewTaskTarget(target: NewTaskTarget) {
  const setTarget = useContext(LauncherContext)?.setTarget;
  useEffect(() => {
    if (!setTarget) return;
    setTarget(target);
    return () => setTarget(null);
  }, [setTarget, target]);
}

// 메뉴 항목에서 열었으면 메뉴가 닫히며 사라지므로 메뉴를 연 버튼으로 포커스를 돌린다
function currentOpener(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest("[role=menu]")) {
    return document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]');
  }
  return active;
}

type Props = {
  workspace: { id: string; slug: string };
  meId: string;
  children: React.ReactNode;
};

export function NewTaskLauncher({ workspace, meId, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<NewTaskDefaults | undefined>();
  const [options, setOptions] = useState<NewTaskOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const target = useRef<NewTaskTarget | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const r = await loadNewTaskOptions(workspace.id);
    if (r.ok) setOptions(r.data);
    else setLoadError(r.error);
  }, [workspace.id]);

  const ctx = useMemo<Ctx>(
    () => ({
      openNewTask(d) {
        opener.current = currentOpener();
        setDefaults(d);
        setOpen(true);
        // 프로젝트 권한이 바뀌었을 수 있어 열 때마다 새로 읽는다
        void load();
      },
      setTarget(t) {
        target.current = t;
      },
    }),
    [load],
  );

  const onCreate = async (input: CreateTaskInput, subtasks: string[]) => {
    let item: TaskItem | null;
    if (target.current) {
      // store가 실패 토스트를 띄운다
      item = await target.current.create(input);
    } else {
      const r = await createTask(input);
      if (!r.ok) toast.error(r.error);
      item = r.ok ? r.data : null;
    }
    if (!item) return false;

    let failed = 0;
    for (const title of subtasks) {
      const r = await createSubtask(item.id, title);
      if (!r.ok) failed += 1;
    }
    if (failed > 0) toast.error(`하위 작업 ${failed}개를 만들지 못했습니다. 작업 상세에서 다시 추가해 주세요.`);

    // 서버 목록을 다시 받아 화면 범위(프로젝트 등)와 하위 작업 수를 맞춘다
    router.refresh();
    const key = item.key;
    toast.success(`${key} 작업을 만들었습니다`, {
      action: {
        label: "열기",
        onClick: () => {
          if (target.current) target.current.open(key);
          else router.push(`/${workspace.slug}/task/${key}`);
        },
      },
    });
    return true;
  };

  return (
    <LauncherContext.Provider value={ctx}>
      {children}
      <NewTaskDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        finalFocus={opener}
        projects={options?.projects ?? (loadError ? [] : null)}
        members={options?.members ?? []}
        meId={meId}
        defaults={defaults}
        loadError={loadError}
        onRetry={() => void load()}
        onCreate={onCreate}
      />
    </LauncherContext.Provider>
  );
}
