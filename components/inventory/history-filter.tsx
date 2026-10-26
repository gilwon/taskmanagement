"use client";
// 서랍 이력 필터. 종류 버튼과 시작일·종료일 입력을 보이고 변경을 주소 쿼리(hk·hf·ht)에 반영한다
import { useId, useState } from "react";
import type { Navigate } from "@/components/inventory/item-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import type { HistoryFilter } from "@/lib/inventory/rules";
import type { StockMovementKind } from "@/lib/inventory/types";

const KINDS: StockMovementKind[] = ["in", "out", "transfer", "adjust"];
const KIND_LABEL = {
  in: "inventory.kind.in",
  out: "inventory.kind.out",
  transfer: "inventory.kind.transfer",
  adjust: "inventory.kind.adjust",
} as const;

// 주소에 반영할 완성 날짜인지 본다. 타이핑 중간 연도(0002 등)는 서버 왕복을 일으키므로 1900 이상만 받는다
const isCommittable = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;

// 날짜 입력 하나. 화면 값은 draft로 들고, 완성 날짜만 주소에 반영한다
function DateField({
  id,
  label,
  value,
  min,
  max,
  onCommit,
}: {
  id: string;
  label: string;
  value: string | undefined;
  min?: string;
  max?: string;
  onCommit: (next: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  // 주소 값이 바뀌면(필터 지우기, 품목 전환) draft를 맞춘다. 반영 직후에는 이미 같아 충돌하지 않는다
  if (value !== prev) {
    setPrev(value);
    setDraft(value ?? "");
  }

  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-(length:--fs-xs) text-(--text-3)">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={draft}
        min={min}
        max={max}
        className="w-40 max-sm:h-10"
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          if (isCommittable(v) && v !== value) onCommit(v);
        }}
        // 타이핑 중간의 빈 값으로는 지우지 않고 포커스를 잃을 때만 지운다
        onBlur={() => {
          if (draft === "" && value) onCommit(null);
        }}
      />
    </div>
  );
}

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
  const id = useId();
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
        <DateField
          id={`${id}-from`}
          label={t("inventory.history.filter.from")}
          value={filter.from}
          max={filter.to}
          onCommit={(v) => set({ hf: v })}
        />
        <DateField
          id={`${id}-to`}
          label={t("inventory.history.filter.to")}
          value={filter.to}
          min={filter.from}
          onCommit={(v) => set({ ht: v })}
        />
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
