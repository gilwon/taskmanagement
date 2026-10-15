"use client";
// 다중 선택 bulk bar. "{n}개 선택됨"과 상태·담당자·우선순위 일괄 변경, 일괄 삭제(실행 취소 토스트는 store가 띄운다)
import { CircleDot, Signal, Trash2, UserRound } from "lucide-react";
import { AssigneePicker, PriorityPicker, StatusPicker } from "@/components/tasks/parts/pickers";
import { useTaskActions } from "@/components/tasks/task-store";
import { ClearButton, TOOLBAR_BTN } from "@/components/tasks/toolbar/task-toolbar";
import { Button } from "@/components/ui/button";

const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

export function BulkBar({ selectedIds, onClear }: { selectedIds: string[]; onClear: () => void }) {
  const actions = useTaskActions();
  if (selectedIds.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="선택한 작업"
      className="flex flex-wrap items-center gap-(--s-1) rounded-(--r) border border-(--border) bg-(--surface) px-2 py-1 shadow-(--shadow-pop)"
    >
      <span className="px-1 text-(length:--fs-sm) font-medium text-(--text)" aria-live="polite">
        {selectedIds.length}개 선택됨
      </span>
      <StatusPicker value={undefined} onChange={(status) => status && void actions.bulkUpdate(selectedIds, { status })}>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <CircleDot {...ICON} />
          상태
        </Button>
      </StatusPicker>
      <AssigneePicker value={undefined} onChange={(assigneeId) => assigneeId !== undefined && void actions.bulkUpdate(selectedIds, { assigneeId })}>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <UserRound {...ICON} />
          담당자
        </Button>
      </AssigneePicker>
      <PriorityPicker value={undefined} onChange={(priority) => priority && void actions.bulkUpdate(selectedIds, { priority })}>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <Signal {...ICON} />
          우선순위
        </Button>
      </PriorityPicker>
      <Button
        variant="ghost"
        className={`${TOOLBAR_BTN} text-(--red) hover:text-(--red)`}
        onClick={async () => {
          if (await actions.bulkRemove(selectedIds)) onClear();
        }}
      >
        <Trash2 {...ICON} />
        삭제
      </Button>
      <ClearButton label="선택 해제" onClick={onClear} className="ml-1 size-6" />
    </div>
  );
}
