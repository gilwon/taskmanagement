"use client";
// 홈·내 작업 화면 공용 부품. 자리별로 굴러가는 숫자, 완료 토글 원형, 프로젝트 점, 패널 틀
import { useEffect, useState } from "react";
import { useTaskActions } from "@/components/tasks/task-store";
import { useT } from "@/lib/i18n/client";
import { colorHex } from "@/lib/i18n/labels";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import "./lucian-home.css";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// 숫자를 자리마다 0~9 기둥으로 그려 바뀐 자리만 굴린다(#098). 첫 그리기는 0에서 굴러 올라간다.
// 모션 줄이기면 CSS가 transition을 꺼 바로 보인다(META §6). 화면 읽기 프로그램에는 최종값만 읽힌다
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // 0으로 한 번 그려진 뒤에 목표 자리로 옮겨야 transition이 돈다
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const str = String(value);
  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden className="u098-num">
        {/* key는 오른쪽(일의 자리)부터 세어 자릿수가 늘어도 기존 자리가 그대로 굴러간다. 숫자가 아닌 글자는 그대로 둔다(원본 /\d/) */}
        {str.split("").map((ch, i) =>
          /\d/.test(ch) ? (
            <span
              key={str.length - i}
              className="u098-col"
              style={{ "--d": ready ? ch : 0, "--i": i } as React.CSSProperties}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          ) : (
            <span key={str.length - i}>{ch}</span>
          ),
        )}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

// 완료 토글(#014). 열린 작업은 완료로, 완료된 작업은 다시 연다(store가 낙관적으로 바꾸고 실패하면 되돌린다)
export function CompleteToggle({ task, size = 16 }: { task: TaskItem; size?: number }) {
  const t = useT();
  const { complete, reopen } = useTaskActions();
  const done = task.status === "done";
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={done ? t("home.complete.reopen", { key: task.key }) : t("home.complete.markDone", { key: task.key })}
      onClick={(e) => {
        e.stopPropagation();
        void (done ? reopen(task.id) : complete(task.id));
      }}
      className="u014-tg inline-flex size-(--h-sm) shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
    >
      {/* #014 원 채우기·체크 그리기. transition이라 처음부터 완료로 그려진 토글은 재생하지 않는다 */}
      <span aria-hidden className="u014-mark" style={{ width: size, height: size }}>
        <svg viewBox="0 0 26 26">
          <path d="M7.5 13.5l3.8 3.8 7.4-8" />
        </svg>
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
