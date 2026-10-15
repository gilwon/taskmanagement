// 작업 표시 부품(상태·우선순위 아이콘, 키, 기한, 라벨 칩, 담당자 아바타). META §3·§4 모양을 디자인 토큰으로 그린다
import { MemberAvatar } from "@/components/shell/member-avatar";
import { formatDue } from "@/lib/format/date";
import {
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
  type TaskLabel,
} from "@/lib/i18n/labels";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/tasks/types";
import { dueBucket } from "@/lib/tasks/view";
import { cn } from "@/lib/utils";

// 점선 원 / 빈 원 / 반 채운 원 / 3/4 원 / 체크 원(META §4)
export function StatusIcon({
  status,
  size = 14,
  className,
}: {
  status: TaskStatus;
  size?: number;
  className?: string;
}) {
  const color = `var(--st-${status})`;
  const label = TASK_STATUS_LABELS[status];
  return (
    <svg
      role="img"
      aria-label={`상태 ${label}`}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <title>{label}</title>
      {status === "done" ? (
        <>
          <circle cx="7" cy="7" r="6" fill={color} />
          <path d="M4.3 7.2l1.8 1.8 3.6-3.8" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle
            cx="7"
            cy="7"
            r="5.6"
            stroke={color}
            strokeWidth="1.6"
            strokeDasharray={status === "backlog" ? "2 1.7" : undefined}
          />
          {status === "progress" && <path d="M7 3.4A3.6 3.6 0 0 1 7 10.6Z" fill={color} />}
          {status === "review" && <path d="M7 7V3.4A3.6 3.6 0 1 1 3.4 7Z" fill={color} />}
        </>
      )}
    </svg>
  );
}

// 긴급은 빨간 ! 상자, 나머지는 신호 막대(가중치만큼 채움), 없음은 점선 막대
export function PriorityIcon({
  priority,
  size = 14,
  className,
}: {
  priority: TaskPriority;
  size?: number;
  className?: string;
}) {
  const label = TASK_PRIORITY_LABELS[priority];
  // none의 표시명("우선순위 없음")에 이미 "우선순위"가 들어 있어 접두어를 붙이지 않는다
  const name = priority === "none" ? label : `우선순위 ${label}`;
  const filled = { urgent: 3, high: 3, medium: 2, low: 1, none: 0 }[priority];
  return (
    <svg
      role="img"
      aria-label={name}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={cn("shrink-0", className)}
    >
      <title>{label}</title>
      {priority === "urgent" ? (
        <>
          <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--red)" />
          <path d="M7 3.6v4.2" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="7" cy="10.2" r="1" fill="var(--surface)" />
        </>
      ) : priority === "none" ? (
        [2, 6, 10].map((x) => (
          <rect key={x} x={x} y="6.4" width="2.4" height="1.4" rx="0.7" fill="var(--text-4)" />
        ))
      ) : (
        [
          { x: 1.5, h: 4 },
          { x: 5.75, h: 7 },
          { x: 10, h: 10 },
        ].map((bar, i) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={12 - bar.h}
            width="2.5"
            height={bar.h}
            rx="0.8"
            fill={i < filled ? "var(--text-2)" : "var(--border-strong)"}
          />
        ))
      )}
    </svg>
  );
}

export function TaskKey({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("shrink-0 font-mono text-(length:--fs-2xs) whitespace-nowrap text-(--text-3)", className)}>
      {value}
    </span>
  );
}

// 기한. 완료되지 않은 작업에서 지남은 빨강, 오늘은 호박색. 기한이 없으면 placeholder를 보인다
export function DueLabel({
  due,
  done = false,
  now,
  placeholder,
  className,
}: {
  due: string | null;
  done?: boolean;
  now?: Date;
  placeholder?: React.ReactNode;
  className?: string;
}) {
  if (!due) {
    return placeholder ? <span className={cn("text-(--text-4)", className)}>{placeholder}</span> : null;
  }
  const at = now ?? new Date();
  const bucket = dueBucket(due, at);
  const tone = done ? "text-(--text-3)" : bucket === "overdue" ? "text-(--red)" : bucket === "today" ? "text-(--amber)" : "text-(--text-3)";
  return (
    <time dateTime={due} className={cn("whitespace-nowrap", tone, className)}>
      {formatDue(due, at)}
    </time>
  );
}

// 라벨 색(META §4)
const LABEL_COLOR: Record<TaskLabel, string> = {
  design: "var(--violet)",
  frontend: "var(--blue)",
  backend: "var(--teal)",
  research: "var(--amber)",
  content: "var(--rose)",
  bug: "var(--red)",
  qa: "var(--green)",
  growth: "var(--orange)",
};

export function LabelChip({ label, className }: { label: string; className?: string }) {
  const color = LABEL_COLOR[label as TaskLabel] ?? "var(--gray)";
  return (
    <span
      className={cn(
        "inline-flex h-(--h-xs) items-center rounded-(--r-xs) px-1.5 text-(length:--fs-2xs) font-medium whitespace-nowrap",
        className,
      )}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {TASK_LABEL_LABELS[label as TaskLabel] ?? label}
    </span>
  );
}

export function LabelChips({ labels, max, className }: { labels: string[]; max?: number; className?: string }) {
  if (labels.length === 0) return null;
  const shown = max === undefined ? labels : labels.slice(0, max);
  const rest = labels.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((l) => (
        <LabelChip key={l} label={l} />
      ))}
      {rest > 0 && (
        <span className="text-(length:--fs-2xs) text-(--text-3)" aria-label={`라벨 ${rest}개 더`}>
          +{rest}
        </span>
      )}
    </span>
  );
}

// 담당자 아바타. 미지정이면 점선 원
export function AssigneeAvatar({
  assignee,
  size = 20,
  className,
}: {
  assignee: TaskItem["assignee"];
  size?: number;
  className?: string;
}) {
  if (!assignee) {
    return (
      <span
        role="img"
        aria-label={UNASSIGNED_LABEL}
        title={UNASSIGNED_LABEL}
        className={cn("inline-block shrink-0 rounded-full border border-dashed border-(--border-strong)", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span role="img" aria-label={`담당자 ${assignee.name}`} title={assignee.name} className={cn("inline-flex shrink-0", className)}>
      <MemberAvatar name={assignee.name} color={assignee.color} size={size} />
    </span>
  );
}
