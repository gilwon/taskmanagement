"use client";
// 작업 상세 본문. 드로어와 전체 페이지가 함께 쓴다. 헤더 동작, 완료·기한 초과 배너, 제목, 속성 목록, 설명, 하위 작업,
// 댓글·활동·파일 탭(detail-tabs). 모든 쓰기는 작업 store를 거쳐 목록과 같은 값을 본다
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Link2,
  Maximize2,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectIcon } from "@/components/shell/project-icon";
import { isPlainKey } from "@/components/shortcuts/keys";
import {
  AssigneeAvatar,
  AssigneePicker,
  DatePicker,
  EstimateInput,
  LabelChips,
  LabelPicker,
  PriorityIcon,
  PriorityPicker,
  RepeatPicker,
  StatusIcon,
  StatusPicker,
  TaskKey,
} from "@/components/tasks/parts";
import { getTaskFavorite, setTaskFavorite } from "@/components/tasks/drawer/actions";
import { BlockedBy } from "@/components/tasks/drawer/blocked-by";
import { DetailTabs } from "@/components/tasks/drawer/detail-tabs";
import { DescriptionEditor } from "@/components/tasks/drawer/description-editor";
import { overdueDays } from "@/components/tasks/drawer/rules";
import { SubtaskSection } from "@/components/tasks/drawer/subtasks";
import { NewTaskDialog } from "@/components/tasks/new-task/new-task-dialog";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useFormatter, useT } from "@/lib/i18n/client";
import { ESTIMATE_LABELS } from "@/lib/i18n/labels";
import { loadTaskDetail } from "@/lib/tasks/actions";
import type { Subtask, TaskDetail, TaskItem, TaskStatus } from "@/lib/tasks/types";

// 입력 중이거나 다른 모달·팝오버가 떠 있으면 한 글자 단축키를 무시한다
function ignoreShortcut(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return true;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return true;
  if (t?.closest("[data-radix-popper-content-wrapper],[role=menu],[role=listbox]")) return true;
  const modals = document.querySelectorAll("[role=dialog][aria-modal=true]");
  return [...modals].some((m) => !m.contains(root));
}

type Props = {
  task: TaskItem;
  mode: "drawer" | "page";
  titleRef?: React.RefObject<HTMLTextAreaElement | null>;
  // 드로어 Esc 순서용(하위 작업 상세 → 드로어)
  escRef?: React.RefObject<(() => boolean) | null>;
  onClose?: () => void;
  // 드로어 ↔ 전체 페이지 전환
  onToggleLayout: () => void;
  // 다른 작업 열기(선행 작업, 전환된 작업)
  onOpenTask: (key: string) => void;
};

export function TaskDetailPanel({ task, mode, titleRef, escRef, onClose, onToggleLayout, onOpenTask }: Props) {
  const t = useT();
  const f = useFormatter();
  const { workspace, members } = useTasks();
  const actions = useTaskActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const ownTitleRef = useRef<HTMLTextAreaElement>(null);
  const titleEl = titleRef ?? ownTitleRef;
  const ownEscRef = useRef<(() => boolean) | null>(null);
  const [now] = useState(() => new Date());
  // 아직 저장하지 않은 제목 입력. 작업 id를 함께 두어 다른 작업으로 바뀌면 그 작업의 제목을 보인다
  type TitleDraft = { id: string; original: string; value: string };
  const [draft, setDraft] = useState<TitleDraft | null>(null);
  const title = draft?.id === task.id ? draft.value : task.title;
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadTaskDetail(task.id).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setDetail(r.data);
        setDetailError(null);
      } else setDetailError(r.error);
    });
    void getTaskFavorite(task.id).then((r) => {
      if (alive && r.ok) setFavorite(r.data);
    });
    return () => {
      alive = false;
    };
  }, [task.id, reload]);

  // 하위 작업 수가 바뀌면 목록 카드의 "1/3"도 맞춘다
  const { patchLocal } = actions;
  const subDone = detail?.subtasks.filter((s) => s.done).length;
  const subTotal = detail?.subtasks.length;
  useEffect(() => {
    if (subTotal === undefined || subDone === undefined) return;
    if (subDone !== task.subtaskDone || subTotal !== task.subtaskTotal) {
      patchLocal(task.id, { subtaskDone: subDone, subtaskTotal: subTotal });
    }
  }, [patchLocal, task.id, task.subtaskDone, task.subtaskTotal, subDone, subTotal]);

  // e 단축키. 편집 모달을 연다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e, "KeyE") || e.repeat || ignoreShortcut(e, rootRef.current)) return;
      e.preventDefault();
      setEditOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const done = task.status === "done";
  const late = overdueDays(task.due_date, task.status, now);
  const assignee = task.assignee;

  // 저장할 제목 초안. blur뿐 아니라 드로어를 닫거나 다른 작업으로 바꿀 때(정리 함수)도 저장하므로 ref로도 둔다
  const titleDraft = useRef<TitleDraft | null>(null);
  const { update } = actions;
  // 초안을 비우고 바뀐 제목만 저장한다. 빈 제목은 저장하지 않는다
  const flushTitle = useCallback(
    (notifyEmpty: boolean) => {
      const d = titleDraft.current;
      if (!d) return;
      titleDraft.current = null;
      setDraft(null);
      const text = d.value.replace(/\s+/g, " ").trim();
      if (!text) {
        if (notifyEmpty) toast.error(t("tasks.detail.titleRequired"));
        return;
      }
      if (text !== d.original) void update(d.id, { title: text });
    },
    [update, t],
  );
  useEffect(() => () => flushTitle(false), [task.id, flushTitle]);

  const commitTitle = () => {
    // 초안을 비우면 store 값(저장했으면 낙관적 갱신값, 빈 제목이면 원래 값)이 보인다
    flushTitle(true);
  };

  const toggleDone = () => void (done ? actions.reopen(task.id) : actions.complete(task.id));

  const setStatus = (s: TaskStatus | undefined) => {
    if (s && s !== task.status) void actions.move(task.id, s);
  };

  const toggleFavorite = async () => {
    if (favorite === null) return;
    const next = !favorite;
    setFavorite(next);
    const r = await setTaskFavorite(workspace.id, task.id, next);
    if (!r.ok) {
      setFavorite(!next);
      toast.error(r.error);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${workspace.slug}/task/${task.key}`);
      toast.success(t("tasks.detail.linkCopied"));
    } catch {
      toast.error(t("tasks.detail.linkCopyFailed"));
    }
  };

  const remove = () => {
    // 드로어를 먼저 닫아 없는 키를 다시 읽지 않게 한다
    onClose?.();
    void actions.remove(task.id);
  };

  const setSubtasks = (update: (list: Subtask[]) => Subtask[]) =>
    setDetail((d) => (d ? { ...d, subtasks: update(d.subtasks) } : d));
  const setDeps = (update: (list: TaskDetail["blockedBy"]) => TaskDetail["blockedBy"]) =>
    setDetail((d) => (d ? { ...d, blockedBy: update(d.blockedBy) } : d));

  const icon = "text-(--text-3) hover:text-(--text)";
  const row = "grid min-h-8 grid-cols-[112px_minmax(0,1fr)] items-center gap-2";
  const label = "text-(length:--fs-sm) text-(--text-3)";
  const value =
    "inline-flex h-(--h-sm) max-w-full items-center gap-1.5 rounded-(--r-sm) px-1.5 text-(length:--fs-base) text-(--text) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-60";
  const empty = <span className="text-(--text-4)">{t("tasks.detail.empty")}</span>;

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 flex-col bg-(--surface)">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-(--divider) pr-2 pl-4">
        <div className="flex min-w-0 items-center gap-1.5 text-(length:--fs-sm) text-(--text-3)">
          <ProjectIcon icon={task.project.icon} color={task.project.color} size={16} />
          <span className="truncate max-[640px]:hidden">{task.project.name}</span>
          <span aria-hidden className="text-(--text-4) max-[640px]:hidden">
            /
          </span>
          <TaskKey value={task.key} className="font-mono" />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button variant="outline" size="sm" className="mr-1 gap-1.5" onClick={toggleDone}>
            <Check size={14} strokeWidth={1.8} aria-hidden />
            <span className="max-[480px]:sr-only">{done ? t("tasks.detail.reopen") : t("tasks.detail.markDone")}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("tasks.detail.favorite")}
            aria-pressed={favorite === true}
            disabled={favorite === null}
            className={favorite ? "text-(--amber)" : icon}
            onClick={() => void toggleFavorite()}
          >
            <Star size={16} strokeWidth={1.8} aria-hidden fill={favorite ? "currentColor" : "none"} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("tasks.detail.copyLink")} className={icon} onClick={() => void copyLink()}>
            <Link2 size={16} strokeWidth={1.8} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={mode === "drawer" ? t("tasks.detail.openPage") : t("tasks.detail.openPanel")}
            className={icon}
            onClick={onToggleLayout}
          >
            {mode === "drawer" ? (
              <Maximize2 size={16} strokeWidth={1.8} aria-hidden />
            ) : (
              <PanelRight size={16} strokeWidth={1.8} aria-hidden />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("tasks.detail.menu")} className={icon}>
                <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil size={14} strokeWidth={1.8} aria-hidden />
                {t("tasks.detail.edit")}
                <kbd className="ml-auto font-mono text-(length:--fs-2xs) text-(--text-3)">E</kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                {t("tasks.detail.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button variant="ghost" size="icon-sm" aria-label={t("tasks.detail.close")} className={icon} onClick={onClose}>
              <X size={16} strokeWidth={1.8} aria-hidden />
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {done && (
          <div className="flex items-center gap-2 border-b border-(--divider) bg-(--green-soft) px-5 py-2 text-(length:--fs-sm) text-(--green)">
            <CheckCircle2 size={14} strokeWidth={1.8} aria-hidden />
            <span className="flex-1">
              {task.completed_at
                ? t("tasks.detail.completedAt", { time: f.relative(task.completed_at, now) })
                : t("tasks.detail.completed")}
            </span>
            <Button variant="ghost" size="xs" className="text-(--green) hover:text-(--green)" onClick={toggleDone}>
              {t("tasks.detail.reopen")}
            </Button>
          </div>
        )}
        {late > 0 && (
          <div className="flex items-center gap-2 border-b border-(--divider) bg-(--red-soft) px-5 py-2 text-(length:--fs-sm) text-(--red)">
            <AlertCircle size={14} strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{t("tasks.detail.overdue", { count: late })}</span>
            <DatePicker label={t("tasks.detail.due")} value={task.due_date} onChange={(v) => void actions.update(task.id, { due: v })}>
              <Button variant="ghost" size="xs" className="text-(--red) hover:text-(--red)">
                {t("tasks.detail.reschedule")}
              </Button>
            </DatePicker>
          </div>
        )}

        <div className={mode === "page" ? "mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6" : "flex flex-col gap-5 px-5 py-4"}>
          <label htmlFor={`title-${task.id}`} className="sr-only">
            {t("tasks.detail.title")}
          </label>
          <textarea
            id={`title-${task.id}`}
            ref={titleEl}
            value={title}
            rows={1}
            maxLength={500}
            onChange={(e) => {
              const value = e.target.value.replace(/\n/g, "");
              const next = { id: task.id, original: draft?.id === task.id ? draft.original : task.title, value };
              titleDraft.current = next;
              setDraft(next);
            }}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              // 제목은 한 줄이다. Shift+Enter 줄바꿈도 막는다
              e.preventDefault();
              e.currentTarget.blur();
            }}
            className="field-sizing-content w-full resize-none rounded-(--r-sm) bg-transparent px-1 py-0.5 text-(length:--fs-xl) leading-snug font-semibold text-(--text) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          />

          <dl className="flex flex-col gap-0.5">
            <div className={row}>
              <dt className={label}>{t("tasks.detail.status")}</dt>
              <dd>
                <StatusPicker value={task.status} onChange={setStatus}>
                  <button type="button" className={value}>
                    <StatusIcon status={task.status} size={14} />
                    {t(`common.taskStatus.${task.status}`)}
                  </button>
                </StatusPicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.priority")}</dt>
              <dd>
                <PriorityPicker value={task.priority} onChange={(v) => v && void actions.update(task.id, { priority: v })}>
                  <button type="button" className={value}>
                    <PriorityIcon priority={task.priority} size={14} />
                    {t(`common.taskPriority.${task.priority}`)}
                  </button>
                </PriorityPicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.assignee")}</dt>
              <dd>
                <AssigneePicker
                  value={task.assignee_id}
                  members={members}
                  onChange={(v) => void actions.update(task.id, { assigneeId: v ?? null })}
                >
                  <button type="button" className={value}>
                    <AssigneeAvatar assignee={assignee} size={18} />
                    {assignee?.name ?? t("common.unassigned")}
                  </button>
                </AssigneePicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.due")}</dt>
              <dd>
                <DatePicker label={t("tasks.detail.due")} value={task.due_date} onChange={(v) => void actions.update(task.id, { due: v })}>
                  <button type="button" className={`${value} ${late > 0 ? "text-(--red)" : ""}`}>
                    {task.due_date ? f.due(task.due_date, now) : empty}
                  </button>
                </DatePicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.start")}</dt>
              <dd>
                <DatePicker label={t("tasks.detail.start")} value={task.start_date} onChange={(v) => void actions.update(task.id, { start: v })}>
                  <button type="button" className={value}>
                    {task.start_date ? f.due(task.start_date, now) : empty}
                  </button>
                </DatePicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.project")}</dt>
              <dd className="flex h-(--h-sm) items-center gap-1.5 px-1.5 text-(length:--fs-base) text-(--text)" title={t("tasks.detail.projectLocked")}>
                <ProjectIcon icon={task.project.icon} color={task.project.color} size={14} />
                <span className="truncate">{task.project.name}</span>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.labels")}</dt>
              <dd>
                <LabelPicker value={task.labels} onChange={(v) => void actions.update(task.id, { labels: v })}>
                  <button type="button" className={value} aria-label={task.labels.length ? t("tasks.detail.labelCount", { count: task.labels.length }) : t("tasks.detail.labels")}>
                    {task.labels.length ? <LabelChips labels={task.labels} /> : empty}
                  </button>
                </LabelPicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.repeat")}</dt>
              <dd>
                <RepeatPicker value={task.recur} onChange={(v) => void actions.update(task.id, { recur: v })}>
                  <button type="button" className={value}>
                    {task.recur === "none" ? empty : t(`common.repeat.${task.recur}`)}
                  </button>
                </RepeatPicker>
              </dd>
            </div>
            <div className={row}>
              <dt className={label}>{t("tasks.detail.estimate")}</dt>
              <dd>
                <EstimateInput value={task.estimate} onChange={(v) => void actions.update(task.id, { estimate: v })}>
                  <button type="button" className={value}>
                    {task.estimate && task.estimate in ESTIMATE_LABELS
                      ? t(`common.estimate.${task.estimate as keyof typeof ESTIMATE_LABELS}`)
                      : empty}
                  </button>
                </EstimateInput>
              </dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-2 py-0.5">
              <dt className={`${label} pt-1.5`}>{t("tasks.detail.blockedBy")}</dt>
              <dd>
                {detail ? (
                  <BlockedBy task={task} deps={detail.blockedBy} setDeps={setDeps} onOpenTask={onOpenTask} />
                ) : (
                  <span className="inline-flex h-(--h-sm) items-center px-1.5 text-(--text-4)">
                    {task.blockedBy.length ? t("tasks.detail.blockedByCount", { count: task.blockedBy.length }) : t("tasks.detail.none")}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <section aria-labelledby={`desc-${task.id}`} className="flex flex-col gap-1.5">
            <h3 id={`desc-${task.id}`} className="text-(length:--fs-sm) font-semibold text-(--text)">
              {t("tasks.detail.description")}
            </h3>
            <DescriptionEditor
              html={task.description_html}
              resetKey={task.id}
              onCommit={(html) => void actions.update(task.id, { descriptionHtml: html })}
            />
          </section>

          {detailError ? (
            <div role="alert" className="flex items-center gap-2 rounded-(--r) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
              <span className="flex-1">{t("tasks.detail.relationsLoadFailed", { error: detailError })}</span>
              <Button variant="outline" size="xs" onClick={() => setReload((n) => n + 1)}>
                {t("tasks.detail.retry")}
              </Button>
            </div>
          ) : detail ? (
            <SubtaskSection
              task={task}
              subtasks={detail.subtasks}
              setSubtasks={setSubtasks}
              escRef={escRef ?? ownEscRef}
              onOpenTask={onOpenTask}
            />
          ) : (
            <p aria-busy="true" className="text-(length:--fs-sm) text-(--text-3)">
              {t("tasks.detail.subtasksLoading")}
            </p>
          )}

          <DetailTabs task={task} />
        </div>
      </div>

      <NewTaskDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        finalFocus={titleEl}
        task={task}
        members={members}
        onUpdate={async (patch, status) => {
          let ok = Object.keys(patch).length === 0 || (await actions.update(task.id, patch));
          if (ok && status) ok = await actions.move(task.id, status);
          return ok;
        }}
      />
    </div>
  );
}
