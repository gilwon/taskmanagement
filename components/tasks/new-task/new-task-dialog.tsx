"use client";
// 새 작업 모달. 만들기 모드는 작업 이름·설명·프로젝트·속성·하위 작업을 받아 만들고, 편집 모드는 기존 작업 값을 채워 고친다.
// ⌘/Ctrl+Enter로 제출하고 "계속 만들기"가 켜져 있으면 이름·설명·하위 작업만 비우고 다시 입력을 받는다
import { useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProjectIcon } from "@/components/shell/project-icon";
import {
  AssigneeAvatar,
  AssigneePicker,
  DatePicker,
  LabelChips,
  LabelPicker,
  PriorityIcon,
  PriorityPicker,
  RepeatPicker,
  StatusIcon,
  StatusPicker,
} from "@/components/tasks/parts";
import { DescriptionEditor } from "@/components/tasks/drawer/description-editor";
import type { ProjectOption } from "@/components/tasks/new-task/actions";
import { diffPatch, parseSubtaskLines, type Fields } from "@/components/tasks/new-task/rules";
import { formatDue } from "@/lib/format/date";
import {
  REPEAT_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
} from "@/lib/i18n/labels";
import type {
  CreateTaskInput,
  TaskItem,
  TaskPatch,
  TaskPriority,
  TaskStatus,
  WorkspaceMember,
} from "@/lib/tasks/types";

export type NewTaskDefaults = Partial<{
  projectId: string;
  status: TaskStatus;
  assigneeId: string | null;
  priority: TaskPriority;
  due: string | null;
  start: string | null;
  labels: string[];
}>;

type Base = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: WorkspaceMember[];
  // 닫은 뒤 포커스를 돌려줄 요소. 없으면 열기 전 포커스로 돌아간다
  finalFocus?: React.RefObject<HTMLElement | null>;
};

export type NewTaskDialogProps = Base &
  (
    | {
        mode: "create";
        // null이면 아직 불러오는 중
        projects: ProjectOption[] | null;
        meId: string;
        defaults?: NewTaskDefaults;
        loadError?: string | null;
        onRetry?: () => void;
        onCreate: (input: CreateTaskInput, subtasks: string[]) => Promise<boolean>;
      }
    | {
        mode: "edit";
        task: TaskItem;
        // status는 바뀌었을 때만 온다(상태는 이동 RPC로 바꾼다)
        onUpdate: (patch: TaskPatch, status: TaskStatus | null) => Promise<boolean>;
      }
  );


function initialFields(props: NewTaskDialogProps): Fields {
  if (props.mode === "edit") {
    const t = props.task;
    return {
      title: t.title,
      description: t.description_html,
      projectId: t.project_id,
      status: t.status,
      assigneeId: t.assignee_id,
      priority: t.priority,
      due: t.due_date,
      start: t.start_date,
      labels: t.labels,
      recur: t.recur,
      subtasks: "",
    };
  }
  const d = props.defaults ?? {};
  return {
    title: "",
    description: null,
    projectId: d.projectId ?? "",
    status: d.status ?? "todo",
    assigneeId: d.assigneeId === undefined ? props.meId : d.assigneeId,
    priority: d.priority ?? "medium",
    due: d.due ?? null,
    start: d.start ?? null,
    labels: d.labels ?? [],
    recur: "none",
    subtasks: "",
  };
}

const chip =
  "inline-flex h-(--h-sm) max-w-full items-center gap-1.5 rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 text-(length:--fs-sm) text-(--text-2) outline-none hover:border-(--border-strong) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-50";

export function NewTaskDialog(props: NewTaskDialogProps) {
  const { open, onOpenChange, finalFocus } = props;
  const editing = props.mode === "edit";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          if (!finalFocus?.current) return;
          e.preventDefault();
          finalFocus.current.focus();
        }}
        className="gap-0 p-0 sm:max-w-[640px] data-open:animate-[modalIn_.2s_var(--ease)] max-[640px]:max-w-[calc(100%-1rem)]"
        aria-describedby={undefined}
      >
        <DialogTitle className="border-b border-(--divider) px-4 py-3 text-(length:--fs-md) font-semibold text-(--text)">
          {editing ? "작업 편집" : "새 작업"}
        </DialogTitle>
        {open && <TaskForm key={editing ? props.task.id : "new"} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm(props: NewTaskDialogProps) {
  const uid = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Fields>(() => initialFields(props));
  const [createMore, setCreateMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [titleError, setTitleError] = useState(false);
  // 계속 만들기에서 설명 편집기를 비우기 위한 키
  const [round, setRound] = useState(0);
  const [now] = useState(() => new Date());
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const editing = props.mode === "edit";
  const members = props.members;
  const projects = props.mode === "create" ? props.projects : null;
  // 기본 프로젝트가 목록에 없으면(권한 없음·불러오는 중) 첫 프로젝트를 고른다
  const projectId =
    props.mode === "edit"
      ? f.projectId
      : projects?.some((p) => p.id === f.projectId)
        ? f.projectId
        : (projects?.[0]?.id ?? "");
  const assignee = members.find((m) => m.id === f.assigneeId);
  const noProject = props.mode === "create" && projects !== null && projects.length === 0;

  const submit = async () => {
    if (pending) return;
    if (!f.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    setPending(true);
    let ok: boolean;
    if (props.mode === "edit") {
      const { patch, status } = diffPatch(props.task, f);
      ok = Object.keys(patch).length === 0 && !status ? true : await props.onUpdate(patch, status);
    } else {
      if (!projectId) {
        setPending(false);
        return;
      }
      ok = await props.onCreate(
        {
          projectId,
          title: f.title.trim(),
          status: f.status,
          priority: f.priority,
          assigneeId: f.assigneeId,
          due: f.due,
          start: f.start,
          labels: f.labels,
          descriptionHtml: f.description,
          recur: f.recur,
        },
        parseSubtaskLines(f.subtasks),
      );
    }
    setPending(false);
    if (!ok) return;
    if (!editing && createMore) {
      setF((prev) => ({ ...prev, title: "", description: null, subtasks: "" }));
      setRound((r) => r + 1);
      titleRef.current?.focus();
      return;
    }
    props.onOpenChange(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void submit();
        }
      }}
      aria-busy={pending}
      className="flex max-h-[min(80dvh,720px)] flex-col"
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3">
        {props.mode === "create" && props.loadError && (
          <div role="alert" className="flex items-center gap-2 rounded-(--r) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
            <span className="flex-1">{props.loadError}</span>
            {props.onRetry && (
              <Button type="button" size="xs" variant="outline" onClick={props.onRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-title`} className="sr-only">
            작업 이름
          </label>
          <Input
            id={`${uid}-title`}
            ref={titleRef}
            autoFocus
            value={f.title}
            maxLength={500}
            placeholder="작업 이름"
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? `${uid}-title-err` : undefined}
            onChange={(e) => {
              set("title", e.target.value);
              setTitleError(false);
            }}
            className="h-auto border-none bg-transparent px-0 py-1 text-(length:--fs-lg) font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {titleError && (
            <p id={`${uid}-title-err`} role="alert" className="text-(length:--fs-xs) text-(--red)">
              작업 이름을 입력해 주세요.
            </p>
          )}
        </div>

        <DescriptionEditor
          html={f.description}
          resetKey={`${editing ? props.task.id : "new"}-${round}`}
          onChange={(html) => set("description", html)}
        />

        <div role="group" aria-label="작업 속성" className="flex flex-wrap gap-1.5">
          {props.mode === "create" ? (
            <Select value={projectId} onValueChange={(v) => set("projectId", v)} disabled={!projects?.length}>
              <SelectTrigger aria-label="프로젝트" size="sm" className={`${chip} w-auto`}>
                <SelectValue placeholder={projects === null ? "프로젝트 불러오는 중…" : "프로젝트 선택"} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <ProjectIcon icon={p.icon} color={p.color} size={14} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className={chip} title="작업의 프로젝트는 바꿀 수 없습니다">
              <ProjectIcon icon={props.task.project.icon} color={props.task.project.color} size={14} />
              {props.task.project.name}
            </span>
          )}
          <StatusPicker value={f.status} onChange={(v) => v && set("status", v)}>
            <button type="button" className={chip} aria-label={`상태 ${TASK_STATUS_LABELS[f.status]}`}>
              <StatusIcon status={f.status} size={14} />
              {TASK_STATUS_LABELS[f.status]}
            </button>
          </StatusPicker>
          <AssigneePicker value={f.assigneeId} members={members} onChange={(v) => set("assigneeId", v ?? null)}>
            <button type="button" className={chip} aria-label={`담당자 ${assignee?.name ?? UNASSIGNED_LABEL}`}>
              <AssigneeAvatar
                assignee={assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null}
                size={16}
              />
              {assignee?.name ?? UNASSIGNED_LABEL}
            </button>
          </AssigneePicker>
          <PriorityPicker value={f.priority} onChange={(v) => v && set("priority", v)}>
            <button type="button" className={chip} aria-label={`우선순위 ${TASK_PRIORITY_LABELS[f.priority]}`}>
              <PriorityIcon priority={f.priority} size={14} />
              {TASK_PRIORITY_LABELS[f.priority]}
            </button>
          </PriorityPicker>
          <DatePicker label="기한" value={f.due} onChange={(v) => set("due", v)}>
            <button type="button" className={chip}>
              {f.due ? `기한 ${formatDue(f.due, now)}` : "기한"}
            </button>
          </DatePicker>
          <DatePicker label="시작일" value={f.start} onChange={(v) => set("start", v)}>
            <button type="button" className={chip}>
              {f.start ? `시작 ${formatDue(f.start, now)}` : "시작일"}
            </button>
          </DatePicker>
          <LabelPicker value={f.labels} onChange={(v) => set("labels", v)}>
            <button type="button" className={chip} aria-label={f.labels.length ? `라벨 ${f.labels.length}개` : "라벨"}>
              {f.labels.length ? <LabelChips labels={f.labels} max={3} /> : "라벨"}
            </button>
          </LabelPicker>
          <RepeatPicker value={f.recur} onChange={(v) => set("recur", v)}>
            <button type="button" className={chip}>
              {f.recur === "none" ? "반복" : REPEAT_LABELS[f.recur]}
            </button>
          </RepeatPicker>
        </div>

        {noProject && (
          <p role="alert" className="text-(length:--fs-sm) text-(--red)">
            작업을 만들 수 있는 프로젝트가 없습니다. 프로젝트 편집 권한을 확인해 주세요.
          </p>
        )}

        {!editing && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-subtasks`} className="text-(length:--fs-xs) font-medium text-(--text-3)">
                하위 작업
              </label>
              <Textarea
                id={`${uid}-subtasks`}
                value={f.subtasks}
                rows={2}
                placeholder="한 줄에 하나씩 입력합니다"
                onChange={(e) => set("subtasks", e.target.value)}
                className="min-h-14 text-(length:--fs-sm)"
              />
            </div>
            <div className="flex items-center gap-2 text-(length:--fs-xs) text-(--text-3)">
              <Paperclip size={14} strokeWidth={1.8} aria-hidden />
              첨부 파일은 작업을 만든 뒤 다음 단계에서 올릴 수 있습니다.
            </div>
          </>
        )}
      </div>

      <DialogFooter className="m-0 flex-row items-center gap-2 rounded-b-xl border-t border-(--divider) bg-(--surface-2) px-4 py-2.5 sm:justify-between">
        {!editing ? (
          <label className="flex items-center gap-2 text-(length:--fs-sm) text-(--text-2)">
            <Switch checked={createMore} onCheckedChange={setCreateMore} />
            계속 만들기
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => props.onOpenChange(false)}>
            취소
          </Button>
          <Button type="submit" size="sm" disabled={pending || (!editing && !projectId)}>
            {pending ? "저장하는 중…" : editing ? "저장" : "작업 만들기"}
            <kbd className="ml-1 font-mono text-(length:--fs-2xs) opacity-70 max-[640px]:hidden">⌘↵</kbd>
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
