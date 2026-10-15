"use client";
// 드로어의 하위 작업 목록과 하위 작업 상세. 진행률, 완료 체크, 추가, 상세(담당자·기한·상위 작업·메모·작업으로 전환·이전/다음·삭제)
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssigneeAvatar, AssigneePicker, DatePicker, DueLabel } from "@/components/tasks/parts";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { convertSubtask, createSubtask, deleteSubtask, updateSubtask } from "@/lib/tasks/actions";
import { formatDue } from "@/lib/format/date";
import { UNASSIGNED_LABEL, UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import type { Subtask, SubtaskPatch, TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type SetSubtasks = (update: (list: Subtask[]) => Subtask[]) => void;

function applyPatch(s: Subtask, p: SubtaskPatch): Subtask {
  return {
    ...s,
    ...(p.title !== undefined && { title: p.title.trim() }),
    ...(p.done !== undefined && { done: p.done }),
    ...(p.assigneeId !== undefined && { assignee_id: p.assigneeId }),
    ...(p.due !== undefined && { due_date: p.due }),
    ...(p.note !== undefined && { note: p.note }),
    ...(p.sortOrder !== undefined && { sort_order: p.sortOrder }),
  };
}

type Props = {
  task: TaskItem;
  subtasks: Subtask[];
  setSubtasks: SetSubtasks;
  // Esc 순서용. 상세가 열려 있으면 닫고 true
  escRef: React.RefObject<(() => boolean) | null>;
  onOpenTask: (key: string) => void;
};

export function SubtaskSection({ task, subtasks, setSubtasks, escRef, onOpenTask }: Props) {
  const { members } = useTasks();
  const actions = useTaskActions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const addBtn = useRef<HTMLButtonElement>(null);

  const done = subtasks.filter((s) => s.done).length;
  const total = subtasks.length;
  const openIndex = subtasks.findIndex((s) => s.id === openId);
  const open = openIndex >= 0 ? subtasks[openIndex] : null;

  // 닫은 뒤 포커스를 돌려줄 요소. 렌더가 끝난 뒤 옮긴다(rAF는 백그라운드 탭에서 멈춘다)
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    target()?.focus();
  });

  const closeDetail = () => {
    const id = openId;
    setOpenId(null);
    if (id) focusNext.current = () => rows.current.get(id);
  };

  const cancelAdd = () => {
    setAdding(false);
    setDraft("");
    focusNext.current = () => addBtn.current;
  };

  // 드로어의 Esc는 문서 단위로 먼저 잡히므로 상세·추가 입력을 여기서 먼저 닫는다
  useEffect(() => {
    escRef.current = () => {
      if (openId) {
        setOpenId(null);
        focusNext.current = () => rows.current.get(openId);
        return true;
      }
      if (adding) {
        setAdding(false);
        setDraft("");
        focusNext.current = () => addBtn.current;
        return true;
      }
      return false;
    };
    return () => {
      escRef.current = null;
    };
  }, [escRef, openId, adding]);

  // 낙관적으로 바꾸고 실패하면 그 하위 작업만 되돌린다
  const patch = async (s: Subtask, p: SubtaskPatch) => {
    setSubtasks((list) => list.map((x) => (x.id === s.id ? applyPatch(x, p) : x)));
    const r = await updateSubtask(s.id, p);
    if (!r.ok) {
      setSubtasks((list) => list.map((x) => (x.id === s.id ? s : x)));
      toast.error(r.error);
      return;
    }
    setSubtasks((list) => list.map((x) => (x.id === s.id ? r.data : x)));
  };

  const add = async () => {
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    const r = await createSubtask(task.id, title);
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    setSubtasks((list) => [...list, r.data]);
    setDraft("");
  };

  const remove = async (s: Subtask) => {
    const r = await deleteSubtask(s.id);
    if (!r.ok) return void toast.error(r.error);
    setSubtasks((list) => list.filter((x) => x.id !== s.id));
    setOpenId(null);
    toast("하위 작업을 삭제했습니다");
  };

  const convert = async (s: Subtask) => {
    const r = await convertSubtask(s.id);
    if (!r.ok) return void toast.error(r.error);
    setSubtasks((list) => list.filter((x) => x.id !== s.id));
    setOpenId(null);
    actions.upsertLocal(r.data);
    const key = r.data.key;
    toast.success(`${key} 작업으로 전환했습니다`, { action: { label: "열기", onClick: () => onOpenTask(key) } });
  };

  return (
    <section aria-labelledby={`subtasks-${task.id}`} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h3 id={`subtasks-${task.id}`} className="text-(length:--fs-sm) font-semibold text-(--text)">
          하위 작업
        </h3>
        {total > 0 && (
          <>
            <span className="font-mono text-(length:--fs-xs) text-(--text-3)">
              {done}/{total}
            </span>
            <div
              role="progressbar"
              aria-label="하위 작업 진행률"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="h-1 w-24 overflow-hidden rounded-(--r-full) bg-(--surface-3)"
            >
              <div className="h-full bg-(--green) transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      {total > 0 && (
        <ul className="flex flex-col">
          {subtasks.map((s) => (
            <li key={s.id} className="group flex h-8 items-center gap-2 rounded-(--r-sm) px-1.5 hover:bg-(--surface-2)">
              <Checkbox
                checked={s.done}
                aria-label={`${s.title} 완료`}
                onCheckedChange={(v) => void patch(s, { done: v === true })}
              />
              <button
                ref={(el) => {
                  if (el) rows.current.set(s.id, el);
                  else rows.current.delete(s.id);
                }}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpenId(s.id)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-(--r-xs) text-left text-(length:--fs-base) text-(--text) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                  s.done && "text-(--text-3) line-through",
                )}
              >
                {s.title}
              </button>
              {s.due_date && <DueLabel due={s.due_date} done={s.done} />}
              {s.assignee_id && (
                <AssigneeAvatar
                  assignee={(() => {
                    const m = members.find((x) => x.id === s.assignee_id);
                    return { id: s.assignee_id, name: m?.name ?? UNKNOWN_USER_LABEL, color: m?.color ?? "slate" };
                  })()}
                  size={18}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <label htmlFor={`subtask-new-${task.id}`} className="sr-only">
            하위 작업 이름
          </label>
          <Input
            id={`subtask-new-${task.id}`}
            autoFocus
            value={draft}
            maxLength={500}
            readOnly={saving}
            placeholder="하위 작업 이름. Enter로 추가, Esc로 취소"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // 전체 페이지에서는 드로어 Esc 처리가 없어 여기서 닫는다
              if (e.key === "Escape" && !e.defaultPrevented) {
                e.preventDefault();
                cancelAdd();
              }
            }}
            onBlur={() => {
              if (!draft.trim()) setAdding(false);
            }}
            className="h-(--h-md) text-(length:--fs-base)"
          />
        </form>
      ) : (
        <button
          ref={addBtn}
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-(--h-sm) w-fit items-center gap-1.5 rounded-(--r-sm) px-1.5 text-(length:--fs-sm) text-(--text-3) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          하위 작업 추가
        </button>
      )}

      {open && (
        <SubtaskDetail
          key={open.id}
          sub={open}
          index={openIndex}
          total={total}
          parent={task}
          onClose={closeDetail}
          onMove={(delta) => setOpenId(subtasks[openIndex + delta]?.id ?? openId)}
          onPatch={(p) => void patch(open, p)}
          onDelete={() => void remove(open)}
          onConvert={() => void convert(open)}
        />
      )}
    </section>
  );
}

type DetailProps = {
  sub: Subtask;
  index: number;
  total: number;
  parent: TaskItem;
  onClose: () => void;
  onMove: (delta: -1 | 1) => void;
  onPatch: (p: SubtaskPatch) => void;
  onDelete: () => void;
  onConvert: () => void;
};

function SubtaskDetail({ sub, index, total, parent, onClose, onMove, onPatch, onDelete, onConvert }: DetailProps) {
  const { members } = useTasks();
  const [title, setTitle] = useState(sub.title);
  const [note, setNote] = useState(sub.note ?? "");
  const [now] = useState(() => new Date());
  const assignee = members.find((m) => m.id === sub.assignee_id);

  const commitTitle = () => {
    const t = title.trim();
    if (t === sub.title) return;
    if (!t) {
      setTitle(sub.title);
      toast.error("하위 작업 이름을 입력해 주세요.");
      return;
    }
    onPatch({ title: t });
  };

  const prop = "grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 min-h-8";
  const value =
    "inline-flex h-(--h-sm) max-w-full items-center gap-1.5 rounded-(--r-sm) px-1.5 text-(length:--fs-base) text-(--text) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)";

  return (
    <section
      role="region"
      aria-label="하위 작업 상세"
      className="absolute inset-0 z-10 flex animate-[fadeOnly_.14s_var(--ease)] flex-col bg-(--surface)"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-(--divider) px-3">
        <Button variant="ghost" size="icon-sm" aria-label="작업으로 돌아가기" onClick={onClose}>
          <ChevronLeft size={16} strokeWidth={1.8} aria-hidden />
        </Button>
        <span className="min-w-0 truncate text-(length:--fs-sm) text-(--text-3)">
          <span className="font-mono">{parent.key}</span> / 하위 작업 {index + 1}/{total}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="이전 하위 작업" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp size={16} strokeWidth={1.8} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 하위 작업"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="flex items-start gap-2">
          <Checkbox
            className="mt-2"
            checked={sub.done}
            aria-label={`${sub.title} 완료`}
            onCheckedChange={(v) => onPatch({ done: v === true })}
          />
          <label htmlFor={`sub-title-${sub.id}`} className="sr-only">
            하위 작업 이름
          </label>
          <Input
            id={`sub-title-${sub.id}`}
            autoFocus
            value={title}
            maxLength={500}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "h-auto border-none bg-transparent px-1 py-1 text-(length:--fs-lg) font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent",
              sub.done && "text-(--text-3) line-through",
            )}
          />
        </div>

        <dl className="flex flex-col gap-0.5">
          <div className={prop}>
            <dt className="text-(length:--fs-sm) text-(--text-3)">담당자</dt>
            <dd>
              <AssigneePicker value={sub.assignee_id} members={members} onChange={(v) => onPatch({ assigneeId: v ?? null })}>
                <button type="button" className={value}>
                  <AssigneeAvatar
                    assignee={assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null}
                    size={18}
                  />
                  {assignee?.name ?? UNASSIGNED_LABEL}
                </button>
              </AssigneePicker>
            </dd>
          </div>
          <div className={prop}>
            <dt className="text-(length:--fs-sm) text-(--text-3)">기한</dt>
            <dd>
              <DatePicker label="기한" value={sub.due_date} onChange={(v) => onPatch({ due: v })}>
                <button type="button" className={value}>
                  {sub.due_date ? formatDue(sub.due_date, now) : <span className="text-(--text-4)">기한 없음</span>}
                </button>
              </DatePicker>
            </dd>
          </div>
          <div className={prop}>
            <dt className="text-(length:--fs-sm) text-(--text-3)">상위 작업</dt>
            <dd>
              <button type="button" className={value} onClick={onClose}>
                <span className="font-mono text-(--text-3)">{parent.key}</span>
                <span className="truncate">{parent.title}</span>
              </button>
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1">
          <label htmlFor={`sub-note-${sub.id}`} className="text-(length:--fs-sm) font-semibold text-(--text)">
            메모
          </label>
          <Textarea
            id={`sub-note-${sub.id}`}
            value={note}
            maxLength={10000}
            placeholder="메모 추가…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (sub.note ?? "")) onPatch({ note: note.trim() ? note : null });
            }}
            className="min-h-24 text-(length:--fs-base)"
          />
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-(--divider) px-5 py-2.5">
        <Button variant="outline" size="sm" onClick={onConvert}>
          <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
          작업으로 전환
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto text-(--red) hover:text-(--red)" onClick={onDelete}>
          <Trash2 size={14} strokeWidth={1.8} aria-hidden />
          삭제
        </Button>
      </footer>
    </section>
  );
}
