"use client";
// 입고·출고·이동·조정 공용 대화상자. kind로 필드와 호출을 바꾼다. 클라이언트 검증은 편의용이고 최종 판정은 서버·DB가 한다
import { useId, useState } from "react";
import { useInventory } from "@/components/inventory/use-inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormatter, useT } from "@/lib/i18n/client";
import { adjustStock, issueStock, receiveStock, transferStock } from "@/lib/inventory/actions";
import { parseQty, parseTarget, sumLevels } from "@/lib/inventory/rules";
import type { StockItem, StockLevel, StockLocation, StockMovementKind } from "@/lib/inventory/types";

type Props = {
  kind: StockMovementKind;
  item: StockItem;
  // 이 품목의 위치별 수량
  levels: StockLevel[];
  // 보관되지 않은 위치
  locations: StockLocation[];
  onClose: () => void;
};

type FieldErrors = Partial<Record<"location" | "to" | "qty", string>>;

const TITLE = {
  in: "inventory.movement.titleIn",
  out: "inventory.movement.titleOut",
  transfer: "inventory.movement.titleTransfer",
  adjust: "inventory.movement.titleAdjust",
} as const;
const DESC = {
  in: "inventory.movement.descIn",
  out: "inventory.movement.descOut",
  transfer: "inventory.movement.descTransfer",
  adjust: "inventory.movement.descAdjust",
} as const;
const SUCCESS = {
  in: "inventory.toast.received",
  out: "inventory.toast.issued",
  transfer: "inventory.toast.transferred",
  adjust: "inventory.toast.adjusted",
} as const;

// 소수 3자리 반올림. 부동소수 오차가 미리보기에 보이지 않게 한다
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function MovementDialog(props: Props) {
  const t = useT();
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(TITLE[props.kind])} · {props.item.name}
          </DialogTitle>
          <DialogDescription>{t(DESC[props.kind])}</DialogDescription>
        </DialogHeader>
        {/* 대화상자가 닫히면 언마운트되므로 열 때마다 입력 상태가 초기화된다 */}
        <MovementForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function MovementForm({ kind, item, levels, locations, onClose }: Props) {
  const t = useT();
  const f = useFormatter();
  const id = useId();
  const { run, pending } = useInventory();

  const qtyAt = (locationId: string) => levels.find((l) => l.locationId === locationId)?.qty ?? 0;
  const needsStock = kind === "out" || kind === "transfer";
  // 출고·이동의 출발은 수량이 있는 위치만 고른다
  const fromOptions = needsStock ? locations.filter((l) => qtyAt(l.id) > 0) : locations;

  const [locationId, setLocationId] = useState(fromOptions.length === 1 ? fromOptions[0].id : "");
  const [toId, setToId] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const parsed = (kind === "adjust" ? parseTarget : parseQty)(qtyText);
  const here = locationId ? qtyAt(locationId) : 0;
  const total = sumLevels(levels);
  const unit = item.unit;

  // 입력과 동시에 판정하는 수량 오류. 제출 버튼도 이 오류가 있으면 막는다
  let liveError: string | null = null;
  if (parsed.ok && locationId) {
    if (needsStock && parsed.value > here) liveError = t("inventory.movement.errExceeds", { qty: here, unit });
    else if (kind === "adjust" && parsed.value === here) liveError = t("inventory.movement.errUnchanged");
  }
  const qtyError = errors.qty ?? liveError;

  // 처리 후 수량 미리보기. 위치(와 이동은 도착)와 올바른 수량이 있을 때만 보인다
  let preview: string | null = null;
  if (parsed.ok && locationId && !liveError && (kind !== "transfer" || toId)) {
    const v = parsed.value;
    if (kind === "in") {
      preview = t("inventory.movement.previewHere", { here: r3(here + v), total: r3(total + v), unit });
    } else if (kind === "out") {
      preview = t("inventory.movement.previewHere", { here: r3(here - v), total: r3(total - v), unit });
    } else if (kind === "transfer") {
      preview = t("inventory.movement.previewTransfer", {
        from: r3(here - v),
        to: r3(qtyAt(toId) + v),
        total,
        unit,
      });
    } else {
      const diff = r3(v - here);
      preview = t("inventory.movement.previewAdjust", {
        diff: (diff > 0 ? "+" : diff < 0 ? "−" : "") + f.number(Math.abs(diff)),
        here: v,
        total: r3(total - here + v),
        unit,
      });
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors = {};
    if (!locationId) next.location = t("inventory.movement.errLocation");
    if (kind === "transfer" && !toId) next.to = t("inventory.movement.errTo");
    if (!parsed.ok) next.qty = t("inventory.errors.invalidQty");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !parsed.ok || liveError) return;

    const q = qtyText.trim();
    const memo = note.trim() || null;
    const r = await run(() => {
      if (kind === "in") return receiveStock(item.id, locationId, q, memo);
      if (kind === "out") return issueStock(item.id, locationId, q, memo);
      if (kind === "transfer") return transferStock(item.id, locationId, toId, q, memo);
      return adjustStock(item.id, locationId, q, memo);
    }, t(SUCCESS[kind]));
    if (r.ok) onClose();
    else if (r.error) setFormError(r.error);
  };

  const describe = (key: keyof FieldErrors, error: string | null | undefined) => ({
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-${key}-error` : undefined,
  });
  const errorText = (key: keyof FieldErrors, error: string | null | undefined) =>
    error && (
      <p id={`${id}-${key}-error`} role={key === "qty" ? "alert" : undefined} className="text-(length:--fs-sm) text-(--red)">
        {error}
      </p>
    );
  const optionLabel = (l: StockLocation) => t("inventory.movement.option", { name: l.name, qty: qtyAt(l.id), unit });
  const toOptions = locations.filter((l) => l.id !== locationId);

  return (
    <form onSubmit={submit} method="post" noValidate className="grid gap-4">
      {formError && (
        <p role="alert" className="rounded-(--r-sm) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
          {formError}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-location`}>{kind === "transfer" ? t("inventory.movement.fromLabel") : t("inventory.movement.location")}</Label>
        <Select
          value={locationId}
          onValueChange={(v) => {
            setLocationId(v);
            if (v === toId) setToId("");
            setErrors((prev) => ({ ...prev, location: undefined }));
          }}
        >
          <SelectTrigger
            id={`${id}-location`}
            autoFocus={!locationId}
            className="w-full data-[size=default]:max-sm:h-10"
            {...describe("location", errors.location)}
          >
            <SelectValue placeholder={t("inventory.movement.select")} />
          </SelectTrigger>
          <SelectContent>
            {fromOptions.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {optionLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorText("location", errors.location)}
      </div>
      {kind === "transfer" && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-to`}>{t("inventory.movement.toLabel")}</Label>
          <Select
            value={toId}
            onValueChange={(v) => {
              setToId(v);
              setErrors((prev) => ({ ...prev, to: undefined }));
            }}
          >
            <SelectTrigger id={`${id}-to`} className="w-full data-[size=default]:max-sm:h-10" {...describe("to", errors.to)}>
              <SelectValue placeholder={t("inventory.movement.select")} />
            </SelectTrigger>
            <SelectContent>
              {toOptions.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {optionLabel(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorText("to", errors.to)}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-qty`}>{kind === "adjust" ? t("inventory.movement.target") : t("inventory.movement.qty")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-qty`}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!!locationId}
            value={qtyText}
            onChange={(e) => {
              setQtyText(e.target.value);
              setErrors((prev) => ({ ...prev, qty: undefined }));
            }}
            className="flex-1 tabular-nums max-sm:h-10"
            aria-invalid={qtyError ? true : undefined}
            aria-describedby={[qtyError ? `${id}-qty-error` : null, preview ? `${id}-preview` : null].filter(Boolean).join(" ") || undefined}
          />
          <span className="shrink-0 text-(length:--fs-base) text-(--text-2)">{unit}</span>
        </div>
        {errorText("qty", qtyError)}
        {preview && (
          <p id={`${id}-preview`} aria-live="polite" className="rounded-(--r-sm) bg-muted px-3 py-2 text-(length:--fs-sm) text-(--text-2) tabular-nums">
            {preview}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>{t("inventory.movement.note")}</Label>
        <Input
          id={`${id}-note`}
          autoComplete="off"
          maxLength={500}
          placeholder={t("inventory.movement.notePlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="max-sm:h-10"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="max-sm:h-10" onClick={onClose}>
          {t("common.action.cancel")}
        </Button>
        <Button type="submit" className="max-sm:h-10" disabled={pending || !!liveError} aria-busy={pending}>
          {pending ? t("common.action.saving") : t(TITLE[kind])}
        </Button>
      </DialogFooter>
    </form>
  );
}
