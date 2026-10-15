"use client";
// 홈·내 작업 화면 공용 부품. 0부터 올라가는 숫자, 완료 토글 원형, 프로젝트 점, 패널 틀
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTaskActions } from "@/components/tasks/task-store";
import { colorHex } from "@/lib/i18n/labels";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const COUNT_MS = 520;

// 숫자를 0(또는 직전 값)에서 목표값까지 ease-out-cubic으로 올린다. 모션 줄이기면 바로 보인다(META §6).
// 화면 읽기 프로그램에는 최종값만 읽힌다
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    const from = shownRef.current;
    const reduce = document.documentElement.dataset.motion !== "full";
    const t0 = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / COUNT_MS);
      const next = Math.round(from + (value - from) * (1 - (1 - p) ** 3));
      shownRef.current = next;
      setShown(next);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

// 완료 토글. 열린 작업은 완료로, 완료된 작업은 다시 연다(store가 낙관적으로 바꾸고 실패하면 되돌린다)
export function CompleteToggle({ task, size = 16 }: { task: TaskItem; size?: number }) {
  const { complete, reopen } = useTaskActions();
  const done = task.status === "done";
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={done ? `${task.key} 다시 열기` : `${task.key} 완료로 표시`}
      onClick={(e) => {
        e.stopPropagation();
        void (done ? reopen(task.id) : complete(task.id));
      }}
      className="inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-full border-[1.5px] transition-colors duration-(--dur)",
          done
            ? "animate-[popCheck_.26s_var(--spring)] border-(--green) bg-(--green) text-(--surface)"
            : "border-(--border-strong) text-transparent hover:border-(--green) hover:text-(--green)",
        )}
        style={{ width: size, height: size }}
      >
        <Check size={size - 6} strokeWidth={1.8} absoluteStrokeWidth />
      </span>
    </button>
  );
}

// 프로젝트 색 점. 이름은 옆 글자나 sr-only로 알린다
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: colorHex(color) }}
    />
  );
}

// 홈 패널 틀. 제목(h2)·오른쪽 슬롯·본문. 진입 시 아래에서 떠오른다(delay ms로 순서를 준다)
export function Panel({
  title,
  titleId,
  action,
  delay = 0,
  className,
  children,
}: {
  title: string;
  titleId: string;
  action?: React.ReactNode;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "min-w-0 animate-[riseIn_.32s_var(--ease)_both] rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-(--divider) px-(--s-4)">
        <h2 id={titleId} className="text-(length:--fs-md) font-semibold text-(--text)">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
