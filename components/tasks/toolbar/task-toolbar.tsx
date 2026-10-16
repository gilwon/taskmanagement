"use client";
// 작업 공통 툴바. 검색·필터(개수 배지)·정렬·그룹·열 표시를 ViewState로 제어한다(META §3 공통 툴바)
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, Columns3, Layers, ListFilter, Search, X } from "lucide-react";
import { useState } from "react";
import { FilterValueList } from "@/components/tasks/toolbar/filter-values";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n/client";
import {
  COLUMN_KEYS,
  FILTER_FIELDS,
  GROUP_FIELDS,
  SORT_FIELDS,
  type FilterField,
  type GroupField,
  type SortField,
  type ViewState,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export const TOOLBAR_BTN =
  "h-(--h-sm) gap-1.5 rounded-(--r-sm) px-2 text-(length:--fs-sm) font-normal text-(--text-2) hover:bg-(--surface-2) hover:text-(--text) aria-expanded:bg-(--surface-2)";
const MENU_CLASS = "min-w-44 rounded-(--r) bg-(--surface) text-(--text) shadow-(--shadow-pop) ring-0";
const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

export function TaskToolbar({
  state,
  onChange,
  showColumns = true,
  showGroup = true,
  children,
}: {
  state: ViewState;
  onChange: (next: ViewState) => void;
  // 표 열 표시 메뉴. 보드처럼 열이 없는 화면은 끈다(완료 표시 토글만 남는다)
  showColumns?: boolean;
  // 그룹 메뉴. 묶지 않는 화면(표)은 끈다
  showGroup?: boolean;
  // 오른쪽 끝 슬롯(목록·보드·표 전환 등)
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div role="toolbar" aria-label={t("tasks.toolbar.label")} className="flex flex-wrap items-center gap-(--s-1)">
      <SearchBox value={state.q} onChange={(q) => onChange({ ...state, q })} />
      <FilterButton state={state} onChange={onChange} />
      <SortMenu state={state} onChange={onChange} />
      {showGroup && <GroupMenu state={state} onChange={onChange} />}
      <DisplayMenu state={state} onChange={onChange} showColumns={showColumns} />
      {children && <div className="ml-auto flex items-center gap-(--s-1)">{children}</div>}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const t = useT();
  return (
    <div className="relative flex items-center">
      <Search {...ICON} className="pointer-events-none absolute left-2 text-(--text-4)" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={t("tasks.toolbar.search")}
        aria-label={t("tasks.toolbar.search")}
        className="h-(--h-sm) w-48 rounded-(--r-sm) border border-(--border) bg-(--surface) pr-2 pl-7 text-(length:--fs-sm) text-(--text) placeholder:text-(--text-4) focus-visible:border-(--accent-line) focus-visible:outline-none max-sm:w-36 [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}

function FilterButton({ state, onChange }: { state: ViewState; onChange: (next: ViewState) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterField | null>(null);
  const count = state.filters.filter((f) => f.v.length > 0).length;
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setField(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" className={TOOLBAR_BTN} aria-label={count ? t("tasks.toolbar.filterApplied", { count }) : t("tasks.toolbar.filter")}>
          <ListFilter {...ICON} />
          {t("tasks.toolbar.filter")}
          {count > 0 && (
            <span
              aria-hidden
              className="inline-flex min-w-4 items-center justify-center rounded-(--r-full) bg-(--accent-soft) px-1 text-(length:--fs-2xs) text-(--accent-ink)"
            >
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t("tasks.toolbar.addFilter")}
        className="w-60 gap-0 rounded-(--r) bg-(--surface) p-0 text-(--text) shadow-(--shadow-pop) ring-0"
      >
        {field ? (
          <>
            <button
              type="button"
              onClick={() => setField(null)}
              className="flex h-(--h-md) w-full items-center gap-1 border-b border-(--divider) px-2 text-(length:--fs-sm) text-(--text-2) hover:bg-(--surface-2)"
            >
              <ChevronLeft {...ICON} />
              {t(`common.filterField.${field}`)}
            </button>
            <FilterValueList field={field} state={state} onChange={onChange} />
          </>
        ) : (
          <Command loop className="rounded-(--r)! bg-transparent">
            <CommandInput placeholder={t("tasks.toolbar.filterFieldSearchPlaceholder")} aria-label={t("tasks.toolbar.filterFieldSearch")} />
            <CommandList aria-label={t("tasks.toolbar.filterFields")}>
              <CommandGroup heading={t("tasks.toolbar.addFilter")}>
                {FILTER_FIELDS.map((f) => (
                  <CommandItem
                    key={f}
                    value={f}
                    keywords={[t(`common.filterField.${f}`)]}
                    onSelect={() => setField(f)}
                    className="h-(--h-md) text-(length:--fs-sm)"
                  >
                    {t(`common.filterField.${f}`)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SortMenu({ state, onChange }: { state: ViewState; onChange: (next: ViewState) => void }) {
  const t = useT();
  const DirIcon = state.sort.dir === 1 ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <DirIcon {...ICON} />
          {t("tasks.toolbar.sortBy", { field: t(`common.sortField.${state.sort.f}`) })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CLASS}>
        <DropdownMenuLabel>{t("tasks.toolbar.sortHeading")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={state.sort.f}
          onValueChange={(f) => onChange({ ...state, sort: { ...state.sort, f: f as SortField } })}
        >
          {SORT_FIELDS.map((f) => (
            <DropdownMenuRadioItem key={f} value={f}>
              {t(`common.sortField.${f}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={String(state.sort.dir)}
          onValueChange={(d) => onChange({ ...state, sort: { ...state.sort, dir: d === "-1" ? -1 : 1 } })}
        >
          <DropdownMenuRadioItem value="1">{t("tasks.toolbar.ascending")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="-1">{t("tasks.toolbar.descending")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GroupMenu({ state, onChange }: { state: ViewState; onChange: (next: ViewState) => void }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <Layers {...ICON} />
          {t("tasks.toolbar.groupBy", { field: t(`common.groupField.${state.group}`) })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CLASS}>
        <DropdownMenuLabel>{t("tasks.toolbar.groupHeading")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.group} onValueChange={(g) => onChange({ ...state, group: g as GroupField })}>
          {GROUP_FIELDS.map((g) => (
            <DropdownMenuRadioItem key={g} value={g}>
              {t(`common.groupField.${g}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DisplayMenu({
  state,
  onChange,
  showColumns,
}: {
  state: ViewState;
  onChange: (next: ViewState) => void;
  showColumns: boolean;
}) {
  const t = useT();
  const toggleColumn = (c: (typeof COLUMN_KEYS)[number], visible: boolean) =>
    onChange({ ...state, hidden: visible ? state.hidden.filter((h) => h !== c) : [...state.hidden, c] });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={TOOLBAR_BTN}>
          <Columns3 {...ICON} />
          {showColumns ? t("tasks.toolbar.columns") : t("tasks.toolbar.display")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CLASS}>
        {showColumns && (
          <>
            <DropdownMenuLabel>{t("tasks.toolbar.visibleColumns")}</DropdownMenuLabel>
            {COLUMN_KEYS.filter((c) => c !== "task").map((c) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={!state.hidden.includes(c)}
                onCheckedChange={(v) => toggleColumn(c, v === true)}
                // 여러 열을 연달아 바꿀 수 있게 열어 둔다
                onSelect={(e) => e.preventDefault()}
              >
                {t(`common.column.${c}`)}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuCheckboxItem
          checked={state.showDone}
          onCheckedChange={(v) => onChange({ ...state, showDone: v === true })}
          onSelect={(e) => e.preventDefault()}
        >
          {t("tasks.toolbar.showDone")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 툴바 버튼과 같은 모양의 작은 아이콘 버튼(칩 삭제 등)
export function ClearButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-4 items-center justify-center rounded-(--r-xs) text-(--text-3) hover:bg-(--surface-3) hover:text-(--text)",
        className,
      )}
    >
      <X size={12} strokeWidth={1.8} aria-hidden />
    </button>
  );
}
