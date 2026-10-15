"use client";
// 작업 속성 선택 팝오버(상태·우선순위·담당자·날짜·라벨·반복·예상 시간). children이 트리거(버튼 요소 하나), value·onChange로 제어한다.
// 목록형은 cmdk(combobox + listbox, ↑↓ Enter)로, 날짜는 grid로 그린다. Esc로 닫으면 Radix가 트리거로 포커스를 돌려준다
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssigneeAvatar, LabelChip, PriorityIcon, StatusIcon } from "@/components/tasks/parts/display";
import { useTasksOptional } from "@/components/tasks/task-store";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMonthTitle, seoulDay } from "@/lib/format/date";
import {
  ESTIMATE_LABELS,
  REPEAT_LABELS,
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/i18n/labels";
import type { RepeatKind, TaskPriority, TaskStatus, WorkspaceMember } from "@/lib/tasks/types";
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/tasks/view";
import { cn } from "@/lib/utils";

type PickerProps<T> = {
  value: T;
  onChange: (value: T) => void;
  // 트리거. 버튼 요소 하나여야 한다(PopoverTrigger asChild)
  children: React.ReactNode;
  disabled?: boolean;
  align?: "start" | "center" | "end";
};

const CONTENT_CLASS =
  "w-60 gap-0 rounded-(--r) bg-(--surface) p-0 text-(--text) shadow-(--shadow-pop) ring-0";
const ITEM_CLASS = "h-(--h-md) text-(length:--fs-sm)";

function Shell({
  open,
  onOpenChange,
  trigger,
  disabled,
  align = "start",
  className,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align={align} aria-label={label} className={cn(CONTENT_CLASS, className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

type Option<T> = { value: T; label: string; icon?: React.ReactNode; hint?: string };

// 단일 선택 목록. cmdk 값은 고유 id로 두고 한국어 표시명을 검색어(keywords)로 준다
function OptionList<T extends string>({
  options,
  value,
  onSelect,
  placeholder,
  onKeyDown,
  footer,
}: {
  options: Option<T>[];
  value: T | undefined;
  onSelect: (value: T) => void;
  placeholder: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  footer?: React.ReactNode;
}) {
  return (
    // 현재 값에 하이라이트를 두고 연다
    <Command loop defaultValue={value} onKeyDown={onKeyDown} className="rounded-(--r)! bg-transparent">
      <CommandInput placeholder={placeholder} aria-label={placeholder} />
      <CommandList>
        <CommandEmpty className="py-4 text-(length:--fs-sm) text-(--text-3)">결과가 없습니다</CommandEmpty>
        <CommandGroup>
          {options.map((o) => (
            <CommandItem
              key={o.value}
              value={o.value}
              keywords={[o.label]}
              data-checked={o.value === value}
              onSelect={() => onSelect(o.value)}
              className={ITEM_CLASS}
            >
              {o.icon && <span aria-hidden className="contents">{o.icon}</span>}
              <span className="truncate">{o.label}</span>
              {o.value === value && <span className="sr-only">(선택됨)</span>}
              {o.hint && <span className="ml-auto text-(length:--fs-2xs) text-(--text-4)">{o.hint}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        {footer}
      </CommandList>
    </Command>
  );
}

// 상태. 1–5 키로 바로 고른다(META §6)
export function StatusPicker({ value, onChange, children, disabled, align }: PickerProps<TaskStatus | undefined>) {
  const [open, setOpen] = useState(false);
  const pick = (s: TaskStatus) => {
    setOpen(false);
    if (s !== value) onChange(s);
  };
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="상태 변경">
      <OptionList
        placeholder="상태 변경…"
        value={value}
        onSelect={pick}
        onKeyDown={(e) => {
          if (/^[1-5]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            pick(STATUS_ORDER[Number(e.key) - 1]);
          }
        }}
        options={STATUS_ORDER.map((s, i) => ({
          value: s,
          label: TASK_STATUS_LABELS[s],
          icon: <StatusIcon status={s} className="size-3.5" />,
          hint: String(i + 1),
        }))}
      />
    </Shell>
  );
}

export function PriorityPicker({ value, onChange, children, disabled, align }: PickerProps<TaskPriority | undefined>) {
  const [open, setOpen] = useState(false);
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="우선순위 설정">
      <OptionList
        placeholder="우선순위 설정…"
        value={value}
        onSelect={(p) => {
          setOpen(false);
          if (p !== value) onChange(p);
        }}
        options={PRIORITY_ORDER.map((p) => ({
          value: p,
          label: TASK_PRIORITY_LABELS[p],
          icon: <PriorityIcon priority={p} className="size-3.5" />,
        }))}
      />
    </Shell>
  );
}

const NONE = "__none__";

// 담당자. members를 주지 않으면 작업 store의 구성원을 쓴다. value null은 미지정, undefined는 여러 값(일괄 편집)
export function AssigneePicker({
  value,
  onChange,
  children,
  disabled,
  align,
  members,
}: PickerProps<string | null | undefined> & { members?: WorkspaceMember[] }) {
  const [open, setOpen] = useState(false);
  const store = useTasksOptional();
  const list = members ?? store?.members ?? [];
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="담당자 지정">
      <OptionList
        placeholder="담당자 검색…"
        value={value === null ? NONE : value}
        onSelect={(v) => {
          setOpen(false);
          const next = v === NONE ? null : v;
          if (next !== value) onChange(next);
        }}
        options={[
          { value: NONE, label: UNASSIGNED_LABEL, icon: <AssigneeAvatar assignee={null} size={18} /> },
          ...list.map((m) => ({
            value: m.id,
            label: m.name,
            icon: <AssigneeAvatar assignee={{ id: m.id, name: m.name, color: m.color }} size={18} />,
            hint: m.id === store?.meId ? "나" : undefined,
          })),
        ]}
      />
    </Shell>
  );
}

export function RepeatPicker({ value, onChange, children, disabled, align }: PickerProps<RepeatKind>) {
  const [open, setOpen] = useState(false);
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="반복 설정">
      <OptionList
        placeholder="반복 설정…"
        value={value}
        onSelect={(r) => {
          setOpen(false);
          if (r !== value) onChange(r);
        }}
        options={(Object.keys(REPEAT_LABELS) as RepeatKind[]).map((r) => ({ value: r, label: REPEAT_LABELS[r] }))}
      />
    </Shell>
  );
}

type Estimate = Exclude<keyof typeof ESTIMATE_LABELS, "clear">;
const ESTIMATES = (Object.keys(ESTIMATE_LABELS) as (keyof typeof ESTIMATE_LABELS)[]).filter(
  (e): e is Estimate => e !== "clear",
);

// 예상 시간. 고정 값 목록에서 고르고 "예상 시간 지우기"로 비운다(DB check 제약과 같은 값)
export function EstimateInput({ value, onChange, children, disabled, align }: PickerProps<string | null>) {
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="예상 시간">
      <OptionList
        placeholder="예상 시간…"
        value={value ?? undefined}
        onSelect={pick}
        options={ESTIMATES.map((e) => ({ value: e, label: ESTIMATE_LABELS[e] }))}
        footer={
          value ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="clear" keywords={[ESTIMATE_LABELS.clear]} onSelect={() => pick(null)} className={ITEM_CLASS}>
                  {ESTIMATE_LABELS.clear}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null
        }
      />
    </Shell>
  );
}

type LabelId = keyof typeof TASK_LABEL_LABELS;
const LABEL_IDS = Object.keys(TASK_LABEL_LABELS) as LabelId[];

// 라벨 여러 개 선택. 고르는 동안 열려 있다. 라벨은 DB가 8개로 고정해 새 라벨은 만들 수 없다
export function LabelPicker({ value, onChange, children, disabled, align }: PickerProps<string[]>) {
  const [open, setOpen] = useState(false);
  const toggle = (l: LabelId) => {
    const set = new Set(value);
    if (set.has(l)) set.delete(l);
    else set.add(l);
    onChange(LABEL_IDS.filter((id) => set.has(id)));
  };
  return (
    <Shell open={open} onOpenChange={setOpen} trigger={children} disabled={disabled} align={align} label="라벨 설정">
      <Command loop className="rounded-(--r)! bg-transparent">
        <CommandInput placeholder="라벨 검색…" aria-label="라벨 검색" />
        <CommandList aria-multiselectable>
          <CommandEmpty className="py-4 text-(length:--fs-sm) text-(--text-3)">결과가 없습니다</CommandEmpty>
          <CommandGroup>
            {LABEL_IDS.map((l) => {
              const on = value.includes(l);
              return (
                <CommandItem
                  key={l}
                  value={l}
                  keywords={[TASK_LABEL_LABELS[l]]}
                  data-checked={on}
                  onSelect={() => toggle(l)}
                  className={ITEM_CLASS}
                >
                  <LabelChip label={l} />
                  {on && <span className="sr-only">(선택됨)</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </Shell>
  );
}

// ─────────────────────────────────────────────
// 날짜. 날짜 라이브러리 없이 Intl로 월 그리드를 그린다. 월요일 시작, Asia/Seoul 기준 오늘
// 날짜는 DB date와 같은 "YYYY-MM-DD" 문자열이고 계산은 UTC 자정 ms로 한다
// ─────────────────────────────────────────────

const DAY_MS = 86_400_000;
const dayLabelFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fromIso = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function DatePicker({
  value,
  onChange,
  children,
  disabled,
  align,
  label = "날짜 선택",
}: PickerProps<string | null> & { label?: string }) {
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align ?? "start"}
        aria-label={label}
        className={cn(CONTENT_CLASS, "w-auto p-(--s-2)")}
        // 첫 버튼 대신 선택한 날(없으면 오늘)에 포커스를 둔다
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MonthGrid value={value} onPick={pick} label={label} />
      </PopoverContent>
    </Popover>
  );
}

function MonthGrid({ value, onPick, label }: { value: string | null; onPick: (v: string | null) => void; label: string }) {
  const today = toIso(seoulDay(new Date()));
  const [focused, setFocused] = useState(value ?? today);
  const gridRef = useRef<HTMLTableElement>(null);

  const f = fromIso(focused);
  const year = new Date(f).getUTCFullYear();
  const month = new Date(f).getUTCMonth();
  const first = Date.UTC(year, month, 1);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - offset * DAY_MS;
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => toIso(start + (w * 7 + d) * DAY_MS)),
  );

  // 포커스한 날이 바뀌면(키보드 이동·월 이동) 그 칸으로 포커스를 옮긴다
  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${focused}"]`)?.focus();
  }, [focused]);

  const moveMonth = (delta: number) => {
    const d = new Date(f);
    const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta + 1, 0)).getUTCDate();
    setFocused(toIso(target + (Math.min(d.getUTCDate(), last) - 1) * DAY_MS));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      setFocused(toIso(f + step * DAY_MS));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      moveMonth(e.key === "PageUp" ? -1 : 1);
    }
  };

  const navBtn =
    "inline-flex size-(--h-sm) items-center justify-center rounded-(--r-xs) text-(--text-3) hover:bg-(--surface-2) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--accent)";

  return (
    <div className="flex flex-col gap-(--s-2)">
      <div className="flex items-center justify-between">
        <button type="button" className={navBtn} aria-label="이전 달" onClick={() => moveMonth(-1)}>
          <ChevronLeft size={14} strokeWidth={1.8} aria-hidden />
        </button>
        <span className="text-(length:--fs-sm) font-medium" aria-live="polite">
          {formatMonthTitle(Date.UTC(year, month, 15))}
        </span>
        <button type="button" className={navBtn} aria-label="다음 달" onClick={() => moveMonth(1)}>
          <ChevronRight size={14} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <table ref={gridRef} role="grid" aria-label={label} onKeyDown={onKeyDown} className="border-collapse">
        <thead>
          <tr>
            {WEEKDAY_SHORT_LABELS.map((w) => (
              <th key={w} scope="col" className="size-8 text-(length:--fs-2xs) font-normal text-(--text-4)">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const inMonth = new Date(fromIso(day)).getUTCMonth() === month;
                const selected = day === value;
                return (
                  <td key={day} role="gridcell" aria-selected={selected} className="p-0">
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      aria-label={dayLabelFmt.format(fromIso(day))}
                      aria-current={day === today ? "date" : undefined}
                      onClick={() => onPick(day)}
                      onFocus={() => day !== focused && setFocused(day)}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full text-(length:--fs-sm) outline-none",
                        "hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)",
                        inMonth ? "text-(--text)" : "text-(--text-4)",
                        day === today && !selected && "font-semibold text-(--accent)",
                        selected && "bg-(--accent) text-(--on-accent) hover:bg-(--accent)",
                      )}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-(--divider) pt-(--s-2)">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="rounded-(--r-xs) px-2 py-1 text-(length:--fs-sm) text-(--text-2) hover:bg-(--surface-2)"
        >
          오늘
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="rounded-(--r-xs) px-2 py-1 text-(length:--fs-sm) text-(--text-3) hover:bg-(--surface-2)"
          >
            날짜 지우기
          </button>
        )}
      </div>
    </div>
  );
}
