"use client";
// 필터 칩바. "조건 {필드} {이다/아니다} {값} 그리고 … 모두 지우기". 값을 누르면 값 선택, 연산자를 누르면 이다↔아니다
import { useState } from "react";
import { useFilterOptions } from "@/components/tasks/toolbar/filter-options";
import { FilterValueList } from "@/components/tasks/toolbar/filter-values";
import { ClearButton } from "@/components/tasks/toolbar/task-toolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FILTER_FIELD_LABELS } from "@/lib/i18n/labels";
import type { Filter, ViewState } from "@/lib/tasks/types";

const OP_LABELS = { is: "이다", not: "아니다" } as const;

export function FilterChipBar({ state, onChange }: { state: ViewState; onChange: (next: ViewState) => void }) {
  const active = state.filters.filter((f) => f.v.length > 0);
  if (active.length === 0) return null;
  return (
    <div role="group" aria-label="적용된 필터" className="flex flex-wrap items-center gap-(--s-1) text-(length:--fs-sm)">
      <span className="text-(--text-3)">조건</span>
      {active.map((f, i) => (
        <span key={f.f} className="contents">
          {i > 0 && <span className="text-(--text-4)">그리고</span>}
          <Chip filter={f} state={state} onChange={onChange} />
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...state, filters: [] })}
        className="ml-1 rounded-(--r-xs) px-1.5 py-0.5 text-(--text-3) hover:bg-(--surface-2) hover:text-(--text)"
      >
        모두 지우기
      </button>
    </div>
  );
}

function Chip({ filter, state, onChange }: { filter: Filter; state: ViewState; onChange: (next: ViewState) => void }) {
  const [open, setOpen] = useState(false);
  const options = useFilterOptions()(filter.f);
  const names = filter.v.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const field = FILTER_FIELD_LABELS[filter.f];
  const replace = (next: Filter | null) =>
    onChange({
      ...state,
      filters: next ? state.filters.map((f) => (f === filter ? next : f)) : state.filters.filter((f) => f !== filter),
    });
  const seg = "px-1.5 py-0.5 hover:bg-(--surface-3)";
  return (
    <span className="inline-flex items-center overflow-hidden rounded-(--r-sm) border border-(--border) bg-(--surface-2)">
      <span className="px-1.5 py-0.5 text-(--text-2)">{field}</span>
      <button
        type="button"
        className={`${seg} text-(--text-3)`}
        aria-label={`${field} 조건을 ${filter.op === "is" ? OP_LABELS.not : OP_LABELS.is}(으)로 바꾸기`}
        onClick={() => replace({ ...filter, op: filter.op === "is" ? "not" : "is" })}
      >
        {OP_LABELS[filter.op]}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`${seg} max-w-48 truncate font-medium text-(--text)`} aria-label={`${field} 값 바꾸기: ${names.join(", ")}`}>
            {names.join(", ")}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={`${field} 값`}
          className="w-60 gap-0 rounded-(--r) bg-(--surface) p-0 text-(--text) shadow-(--shadow-pop) ring-0"
        >
          <FilterValueList field={filter.f} state={state} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <ClearButton label={`${field} 조건 지우기`} onClick={() => replace(null)} className="mr-1" />
    </span>
  );
}
