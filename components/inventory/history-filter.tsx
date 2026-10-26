"use client";
// 서랍 이력 필터. 종류 버튼과 기간 선택 달력(시작일·종료일)을 보이고 변경을 주소 쿼리(hk·hf·ht)에 반영한다
import { useMemo, useState } from "react";
import { RangeCalendar } from "@/components/inventory/range-calendar";
import type { Navigate } from "@/components/inventory/item-table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale, useT } from "@/lib/i18n/client";
import type { HistoryFilter } from "@/lib/inventory/rules";
import type { StockMovementKind } from "@/lib/inventory/types";

const KINDS: StockMovementKind[] = ["in", "out", "transfer", "adjust"];
const KIND_LABEL = {
  in: "inventory.kind.in",
  out: "inventory.kind.out",
  transfer: "inventory.kind.transfer",
  adjust: "inventory.kind.adjust",
} as const;

export function HistoryFilterBar({
  filter,
  filtered,
  navigate,
}: {
  filter: HistoryFilter;
  filtered: boolean;
  navigate: Navigate;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  // 기간 단추에 보일 날짜. 연도까지 적어 해가 다른 기간도 헷갈리지 않게 한다
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }), [locale]);
  const show = (v: string) => fmt.format(new Date(`${v}T00:00:00Z`));
  const rangeText = filter.from || filter.to ? `${filter.from ? show(filter.from) : ""} – ${filter.to ? show(filter.to) : ""}` : t("inventory.history.range.placeholder");
  // 서버가 주소 값을 다시 검증하므로 여기서는 빈 값만 주소에서 지운다
  const set = (patch: Record<string, string | null>) => navigate(patch, "replace");

  return (
    <div className="mb-3 grid gap-2">
      <div role="group" aria-label={t("inventory.history.filter.label")} className="flex flex-wrap gap-1.5">
        {[null, ...KINDS].map((k) => {
          const pressed = (filter.kind ?? null) === k;
          return (
            <Button
              key={k ?? "all"}
              type="button"
              size="sm"
              variant={pressed ? "default" : "outline"}
              aria-pressed={pressed}
              className="max-sm:h-10"
              onClick={() => set({ hk: k })}
            >
              {k ? t(KIND_LABEL[k]) : t("inventory.history.filter.all")}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="max-sm:h-10" aria-label={`${t("inventory.history.range.label")} ${rangeText}`}>
              {rangeText}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[350px] max-w-[calc(100vw-1rem)] gap-0 rounded-[28px] bg-transparent p-0 shadow-none">
            <RangeCalendar
              from={filter.from}
              to={filter.to}
              onApply={(from, to) => {
                set({ hf: from, ht: to });
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {filtered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-sm:h-10"
            onClick={() => set({ hk: null, hf: null, ht: null })}
          >
            {t("inventory.history.filter.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
