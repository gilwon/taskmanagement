"use client";
// 목록·보드·표가 함께 쓰는 부품. 뷰 제어 객체 타입, 인라인 작업 컴포저, 작업 ⋯ 메뉴, 놓을 자리 표시, #sr-live 알림
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskActions } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import type { DropTarget } from "@/components/tasks/views/use-drag";
import type { GroupField, TaskGroup, TaskItem, ViewState } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export type ViewProject = { id: string; key: string; name: string; color: string; icon: string };

// 래퍼(TaskViews)가 만들어 각 뷰에 내려 주는 제어 객체
export type ViewCtl = {
  state: ViewState;
  setState: (next: ViewState) => void;
  now: Date;
  showProject: boolean;
  // 컴포저가 고를 수 있는 프로젝트. 프로젝트 화면은 그 프로젝트 하나
  projects: ViewProject[];
  selected: ReadonlySet<string>;
  select: (id: string, opts: { range: boolean }) => void;
  // 놓은 자리로 작업을 옮긴다. index는 끌던 작업을 뺀 목록 기준
  drop: (id: string, target: DropTarget, groups: TaskGroup[], field: GroupField) => void;
  // Alt+화살표 키보드 이동
  keyMove: (e: React.KeyboardEvent, id: string, groups: TaskGroup[], field: GroupField) => void;
  // 그룹 값을 채워 작업을 만든다
  create: (field: GroupField, groupKey: string, title: string, projectId: string) => Promise<boolean>;
  canAssign: (field: GroupField, groupKey: string) => boolean;
};

// 드래그·키보드 이동 안내. 카드·행의 aria-describedby가 가리킨다
export const MOVE_HINT_ID = "task-move-hint";
export function MoveHint({ board }: { board?: boolean }) {
  return (
    <p id={MOVE_HINT_ID} className="sr-only">
      {board
        ? "Enter로 작업을 엽니다. Alt+위아래 화살표로 순서를, Alt+좌우 화살표로 열을 옮깁니다. 상태 선택으로도 열을 바꿀 수 있습니다."
        : "Enter로 작업을 엽니다. Alt+위아래 화살표로 순서를 옮깁니다. 상태 선택으로도 묶음을 바꿀 수 있습니다."}
    </p>
  );
}

// 화면 읽기 프로그램 알림. 같은 문장을 다시 넣어도 읽히도록 비웠다가 다음 프레임에 넣는다
export function announce(message: string) {
  const el = document.getElementById("sr-live");
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

// 키보드 이동 뒤 다시 그려진 카드·행으로 포커스를 돌려준다
export function refocus(id: string) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag-id="${id}"]`)?.focus()),
  );
}

// 놓을 자리 표시선
export function DropLine() {
  return <div aria-hidden className="pointer-events-none h-0.5 rounded-full bg-(--accent)" />;
}

// 작업을 끌고 있는 동안 목록에 끼울 표시선 위치를 계산한다. 끄는 작업 자신은 index 계산에서 빠진다
export function dropIndexMarks(items: TaskItem[], dragId: string | null, target: DropTarget | null, group: string) {
  if (!dragId || target?.group !== group) return { before: () => false, end: false };
  const others = items.filter((t) => t.id !== dragId);
  const at = target.index;
  return {
    // 전체 목록 i번째 항목 앞에 표시선을 그릴지
    before: (i: number) => {
      const t = items[i];
      if (t.id === dragId) return false;
      return others.indexOf(t) === at;
    },
    end: at >= others.length,
  };
}

// 그룹 하단 "+ 작업 추가" 인라인 입력. Enter로 만들고 입력을 비운 채 열어 두며, Esc나 빈 채로 벗어나면 닫는다
export function InlineComposer({
  ctl,
  field,
  groupKey,
  onClose,
  className,
}: {
  ctl: ViewCtl;
  field: GroupField;
  groupKey: string;
  onClose: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const fixedProject = field === "project" ? groupKey : ctl.projects.length === 1 ? ctl.projects[0].id : null;
  const [projectId, setProjectId] = useState(fixedProject ?? ctl.projects[0]?.id ?? "");

  const submit = async () => {
    const title = value.trim();
    if (!title || busy || !projectId) return;
    setBusy(true);
    const ok = await ctl.create(field, groupKey, title, fixedProject ?? projectId);
    setBusy(false);
    if (ok) setValue("");
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        autoFocus
        value={value}
        // disabled는 포커스를 빼앗아 연속 입력이 끊기므로 readOnly로 막는다
        readOnly={busy}
        aria-busy={busy}
        aria-label="새 작업 이름"
        placeholder="작업 이름 — Enter로 추가, Esc로 취소"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        onBlur={(e) => {
          // 프로젝트 선택으로 포커스가 옮겨 갈 때는 닫지 않는다
          if (!value.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget)) onClose();
        }}
        className="h-(--h-md) min-w-0 flex-1 rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-2.5 text-(length:--fs-base) text-(--text) outline-none placeholder:text-(--text-4) focus-visible:ring-2 focus-visible:ring-(--accent)"
      />
      {!fixedProject && ctl.projects.length > 1 && (
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger size="sm" aria-label="프로젝트" className="h-(--h-md) w-32 shrink-0 text-(length:--fs-sm)">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ctl.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// 그룹·열 하단의 "+ 작업 추가" 버튼
export function AddTaskButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-(--h-md) items-center gap-1.5 rounded-(--r-sm) px-2 text-(length:--fs-sm) text-(--text-3) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)",
        className,
      )}
    >
      <span aria-hidden>+</span> 작업 추가
    </button>
  );
}

// 작업 ⋯ 메뉴. 열기·제목 편집·완료/다시 열기·보관·삭제
export function TaskMenu({ task, onRename }: { task: TaskItem; onRename?: () => void }) {
  const { open } = useTaskDrawer();
  const { complete, reopen, update, remove } = useTaskActions();
  const done = task.status === "done";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${task.key} 작업 메뉴`}
          className="inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) outline-none hover:bg-(--surface-3) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <MoreHorizontal aria-hidden size={15} strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => open(task.key)}>열기</DropdownMenuItem>
        {onRename && <DropdownMenuItem onSelect={onRename}>제목 편집</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => void (done ? reopen(task.id) : complete(task.id))}>
          {done ? "다시 열기" : "완료로 표시"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void update(task.id, { archived: true })}>보관</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void remove(task.id)}>
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 제목 인라인 편집 입력. Enter·blur로 저장, Esc로 취소
export function TitleEditor({ task, onDone, className }: { task: TaskItem; onDone: () => void; className?: string }) {
  const { update } = useTaskActions();
  const save = (value: string) => {
    const title = value.trim();
    onDone();
    if (title && title !== task.title) void update(task.id, { title });
  };
  return (
    <input
      autoFocus
      defaultValue={task.title}
      aria-label={`${task.key} 제목`}
      maxLength={500}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          save(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onDone();
        }
      }}
      onBlur={(e) => save(e.currentTarget.value)}
      className={cn(
        "h-(--h-sm) min-w-0 flex-1 rounded-(--r-xs) border border-(--accent) bg-(--surface) px-1.5 text-(length:--fs-base) text-(--text) outline-none",
        className,
      )}
    />
  );
}

// 행·카드를 누르면 드로어를 연다. 안쪽 버튼·입력·체크박스를 누른 경우는 제외한다
export function isInnerControl(target: EventTarget) {
  return !!(target as HTMLElement).closest(
    "button, a, input, textarea, select, [role=checkbox], [role=menu], [data-no-row-click]",
  );
}
