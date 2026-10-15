"use client";
// 필터 값 선택 목록과 필터 갱신 함수. 툴바의 필터 팝오버와 칩바가 함께 쓴다
import { useFilterOptions } from "@/components/tasks/toolbar/filter-options";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FILTER_FIELD_LABELS } from "@/lib/i18n/labels";
import type { FilterField, ViewState } from "@/lib/tasks/types";

// 필드의 값을 켜고 끈다. 필드마다 필터는 하나이고, 값이 모두 빠지면 필터를 지운다
export function toggleFilterValue(state: ViewState, field: FilterField, value: string): ViewState {
  const current = state.filters.find((f) => f.f === field);
  if (!current) return { ...state, filters: [...state.filters, { f: field, op: "is", v: [value] }] };
  const v = current.v.includes(value) ? current.v.filter((x) => x !== value) : [...current.v, value];
  return {
    ...state,
    filters: v.length === 0 ? state.filters.filter((f) => f !== current) : state.filters.map((f) => (f === current ? { ...f, v } : f)),
  };
}

export function FilterValueList({
  field,
  state,
  onChange,
}: {
  field: FilterField;
  state: ViewState;
  onChange: (next: ViewState) => void;
}) {
  const options = useFilterOptions()(field);
  const selected = state.filters.find((f) => f.f === field)?.v ?? [];
  const placeholder = `${FILTER_FIELD_LABELS[field]} 검색…`;
  return (
    <Command loop className="rounded-(--r)! bg-transparent">
      <CommandInput placeholder={placeholder} aria-label={placeholder} autoFocus />
      <CommandList aria-multiselectable>
        <CommandEmpty className="py-4 text-(length:--fs-sm) text-(--text-3)">결과가 없습니다</CommandEmpty>
        <CommandGroup>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <CommandItem
                key={o.value}
                value={o.value}
                keywords={[o.label]}
                data-checked={on}
                onSelect={() => onChange(toggleFilterValue(state, field, o.value))}
                className="h-(--h-md) text-(length:--fs-sm)"
              >
                {o.icon && <span aria-hidden className="contents">{o.icon}</span>}
                <span className="truncate">{o.label}</span>
                {on && <span className="sr-only">(선택됨)</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
