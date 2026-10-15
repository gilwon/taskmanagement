"use client";
// 작업 우클릭 메뉴. 목록 행·보드 카드·표 행을 감싸 열기·상태·우선순위·담당자·복사·즐겨찾기·보관·삭제를 보인다.
// Shift+F10·메뉴 키로도 열고(KeyContextMenu), 편집 권한이 없으면 편집 항목을 숨긴다. 끌기와 겹치므로 터치 길게 누르기로는 열지 않는다
import { useState } from "react";
import { toast } from "sonner";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { KeyContextMenu, copyText as copy } from "@/components/shortcuts/key-context-menu";
import { getTaskFavorite, setTaskFavorite } from "@/components/tasks/drawer/actions";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, UNASSIGNED_LABEL } from "@/lib/i18n/labels";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/tasks/types";

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];
const NONE = "none";

export function TaskContextMenu({ task, children }: { task: TaskItem; children: React.ReactElement }) {
  const { open } = useTaskDrawer();
  const { move, update, remove } = useTaskActions();
  const { members, workspace } = useTasks();
  const [favorite, setFavorite] = useState<boolean | null>(null);

  const onOpenChange = (next: boolean) => {
    if (!next) return;
    setFavorite(null);
    void getTaskFavorite(task.id).then((r) => r.ok && setFavorite(r.data));
  };

  const toggleFavorite = async () => {
    if (favorite === null) return;
    const next = !favorite;
    setFavorite(next);
    const r = await setTaskFavorite(workspace.id, task.id, next);
    if (!r.ok) {
      setFavorite(!next);
      toast.error(r.error);
    } else {
      toast.success(next ? "즐겨찾기에 추가했습니다" : "즐겨찾기에서 뺐습니다");
    }
  };

  return (
    <KeyContextMenu
      label={`${task.key} 작업 메뉴`}
      blockTouch
      onOpenChange={onOpenChange}
      menu={
        <>
          <ContextMenuItem onSelect={() => open(task.key)}>열기</ContextMenuItem>
          {task.canEdit && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>상태</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-40">
                  <ContextMenuRadioGroup
                    value={task.status}
                    onValueChange={(v) => v !== task.status && void move(task.id, v as TaskStatus)}
                  >
                    {STATUSES.map((s) => (
                      <ContextMenuRadioItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>우선순위</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-40">
                  <ContextMenuRadioGroup
                    value={task.priority}
                    onValueChange={(v) => v !== task.priority && void update(task.id, { priority: v as TaskPriority })}
                  >
                    {PRIORITIES.map((p) => (
                      <ContextMenuRadioItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>담당자</ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
                  <ContextMenuRadioGroup
                    value={task.assignee_id ?? NONE}
                    onValueChange={(v) => {
                      const id = v === NONE ? null : v;
                      if (id !== task.assignee_id) void update(task.id, { assigneeId: id });
                    }}
                  >
                    <ContextMenuRadioItem value={NONE}>{UNASSIGNED_LABEL}</ContextMenuRadioItem>
                    {members.map((m) => (
                      <ContextMenuRadioItem key={m.id} value={m.id}>
                        <span className="truncate">{m.name}</span>
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void copy(task.key, "키")}>키 복사</ContextMenuItem>
          <ContextMenuItem
            onSelect={() => void copy(`${window.location.origin}/${workspace.slug}/task/${task.key}`, "링크")}
          >
            링크 복사
          </ContextMenuItem>
          <ContextMenuCheckboxItem
            checked={favorite === true}
            disabled={favorite === null}
            onSelect={() => void toggleFavorite()}
          >
            즐겨찾기
          </ContextMenuCheckboxItem>
          {task.canEdit && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => void update(task.id, { archived: true })}>보관</ContextMenuItem>
              <ContextMenuItem variant="destructive" onSelect={() => void remove(task.id)}>
                삭제
              </ContextMenuItem>
            </>
          )}
        </>
      }
    >
      {children}
    </KeyContextMenu>
  );
}
