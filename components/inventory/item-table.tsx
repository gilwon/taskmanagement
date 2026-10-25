"use client";
// 품목 탭. 검색·카테고리·부족 필터(주소의 q·cat·low와 같은 상태)와 품목 표를 그린다. 행을 열면 ?item=<id>로 주소에 반영한다
import { Package, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/inventory/status-badge";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatter, useT } from "@/lib/i18n/client";
import type { StockItemRow } from "@/lib/inventory/types";

export type StockFilters = { q: string; cat: string; low: boolean };
// 주소 쿼리 변경. null이면 해당 키를 지운다. push는 기록을 남기고 replace는 남기지 않는다
export type Navigate = (patch: Record<string, string | null>, mode?: "push" | "replace") => void;

type Props = {
  items: StockItemRow[];
  categories: string[];
  filters: StockFilters;
  selectedId: string | null;
  canManage: boolean;
  onAdd: () => void;
  navigate: Navigate;
};

const ALL = "all";
const DEBOUNCE_MS = 300;

export function ItemTable({ items, categories, filters, selectedId, canManage, onAdd, navigate }: Props) {
  const t = useT();
  const f = useFormatter();
  const hasFilter = filters.q !== "" || filters.cat !== "" || filters.low;

  // 입력 중인 검색어. 주소의 q가 바뀌었는데 마지막으로 주소에 보낸 값(sent)과 다르면 외부 변경(뒤로 가기 등)으로 보고 따라간다
  const [q, setQ] = useState(filters.q);
  const [sent, setSent] = useState(filters.q);
  const [prevUrlQ, setPrevUrlQ] = useState(filters.q);
  if (filters.q !== prevUrlQ) {
    setPrevUrlQ(filters.q);
    if (filters.q !== sent) {
      setSent(filters.q);
      setQ(filters.q);
    }
  }
  useEffect(() => {
    const next = q.trim();
    if (next === sent) return;
    const timer = setTimeout(() => {
      setSent(next);
      navigate({ q: next || null }, "replace");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, sent, navigate]);

  if (items.length === 0 && !hasFilter) {
    return (
      <EmptyState
        icon={Package}
        title={t("inventory.empty.noItemsTitle")}
        description={canManage ? t("inventory.empty.noItemsDescription") : t("inventory.empty.noItemsRequest")}
        action={
          canManage && (
            <Button onClick={onAdd}>
              <Plus aria-hidden strokeWidth={1.8} />
              {t("inventory.page.addItem")}
            </Button>
          )
        }
      />
    );
  }

  // 목록에 없는 카테고리가 주소에 남아 있어도 선택값이 보이도록 넣는다
  const options = filters.cat && !categories.includes(filters.cat) ? [filters.cat, ...categories] : categories;
  const reset = () => {
    setQ("");
    setSent("");
    navigate({ q: null, cat: null, low: null }, "replace");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-(--gutter) pb-(--s-3)">
        <div className="relative w-full max-w-xs min-w-0 flex-1">
          <Search
            aria-hidden
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--text-3)"
          />
          <Input
            type="search"
            aria-label={t("inventory.filter.search")}
            placeholder={t("inventory.filter.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-(--h-md) pl-8 max-sm:h-10"
          />
        </div>
        <Select
          value={filters.cat || ALL}
          onValueChange={(v) => navigate({ cat: v === ALL ? null : v }, "replace")}
        >
          <SelectTrigger aria-label={t("inventory.filter.category")} className="h-(--h-md) w-44 max-sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("inventory.filter.allCategories")}</SelectItem>
            {options.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex min-h-(--h-md) items-center gap-2 max-sm:min-h-10">
          <Switch
            id="inventory-low-only"
            checked={filters.low}
            onCheckedChange={(v) => navigate({ low: v ? "1" : null }, "replace")}
          />
          <Label htmlFor="inventory-low-only" className="cursor-pointer text-(length:--fs-base) text-(--text-2)">
            {t("inventory.filter.lowOnly")}
          </Label>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("inventory.empty.noMatchTitle")}
          description={t("inventory.empty.noMatchDescription")}
          action={
            <Button variant="outline" onClick={reset}>
              {t("inventory.filter.reset")}
            </Button>
          }
        />
      ) : (
        <div className="px-(--gutter)">
          <Table className="text-(length:--fs-base)">
            <TableHeader>
              <TableRow>
                <TableHead>{t("inventory.column.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.column.sku")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("inventory.column.category")}</TableHead>
                <TableHead className="text-right">{t("inventory.column.onHand")}</TableHead>
                <TableHead>{t("inventory.column.status")}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{t("inventory.column.safety")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const open = () => navigate({ item: item.id }, "push");
                return (
                  <TableRow
                    key={item.id}
                    data-state={item.id === selectedId ? "selected" : undefined}
                    className="h-(--row-h) cursor-pointer max-sm:h-12"
                    onClick={open}
                  >
                    <TableCell className="max-w-0 min-w-36">
                      {/* 키보드 진입점. Enter·Space의 click이 행으로 전파되어 open이 한 번만 불린다 */}
                      <button
                        type="button"
                        className="block max-w-full truncate rounded-(--r-xs) text-left font-medium text-(--text) outline-none focus-visible:ring-2 focus-visible:ring-(--accent) max-sm:min-h-10"
                      >
                        {item.name}
                      </button>
                      <span className="block truncate text-(length:--fs-xs) text-(--text-3) md:hidden">{item.sku}</span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-(--text-2) md:table-cell">{item.sku}</TableCell>
                    <TableCell className="hidden text-(--text-2) lg:table-cell">{item.category ?? "—"}</TableCell>
                    <TableCell className="text-right text-(--text) tabular-nums">
                      {f.number(item.total)} <span className="text-(--text-3)">{item.unit}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="hidden text-right text-(--text-2) tabular-nums md:table-cell">
                      {f.number(item.safetyStock)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
