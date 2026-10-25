"use client";
// 품목 추가·수정 겸용 대화상자. item이 있으면 수정, 없으면 추가한다. 입력 오류는 필드 아래에, 서버 오류는 폼 상단에 보인다
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
import { useT } from "@/lib/i18n/client";
import { createStockItem, updateStockItem } from "@/lib/inventory/actions";
import { parseTarget } from "@/lib/inventory/rules";
import type { StockItem } from "@/lib/inventory/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  categories: string[];
  item?: StockItem;
};

type FieldErrors = Partial<Record<"name" | "sku" | "unit" | "safety", string>>;

export function ItemFormDialog({ open, onOpenChange, ...rest }: Props) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rest.item ? t("inventory.form.editTitle") : t("inventory.form.addTitle")}</DialogTitle>
          <DialogDescription>{t("inventory.form.description")}</DialogDescription>
        </DialogHeader>
        {/* 대화상자가 닫히면 언마운트되므로 열 때마다 입력 상태가 초기화된다 */}
        <ItemForm onDone={() => onOpenChange(false)} {...rest} />
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({ onDone, workspaceId, categories, item }: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useT();
  const id = useId();
  const { run, pending } = useInventory();
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [safety, setSafety] = useState(item ? String(item.safetyStock) : "0");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t("inventory.form.required");
    if (!sku.trim()) next.sku = t("inventory.form.required");
    if (!unit.trim()) next.unit = t("inventory.form.required");
    const target = parseTarget(safety);
    if (!target.ok) next.safety = t("inventory.errors.invalidQty");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !target.ok) return;

    const input = {
      name: name.trim(),
      sku: sku.trim(),
      unit: unit.trim(),
      category: category.trim() || null,
      safetyStock: target.value,
    };
    const r = await run(
      () => (item ? updateStockItem(item.id, input) : createStockItem(workspaceId, input)),
      item ? t("inventory.toast.itemUpdated") : t("inventory.toast.itemAdded"),
    );
    if (r.ok) onDone();
    else if (r.error) setFormError(r.error);
  };

  const field = (key: keyof FieldErrors) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const fieldError = (key: keyof FieldErrors) =>
    errors[key] && (
      <p id={`${id}-${key}-error`} className="text-(length:--fs-sm) text-(--red)">
        {errors[key]}
      </p>
    );

  return (
    <form onSubmit={submit} method="post" noValidate className="grid gap-4">
      {formError && (
        <p role="alert" className="rounded-(--r-sm) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
          {formError}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>{t("inventory.form.name")}</Label>
        <Input
          id={`${id}-name`}
          autoFocus
          autoComplete="off"
          maxLength={100}
          placeholder={t("inventory.form.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-sm:h-10"
          {...field("name")}
        />
        {fieldError("name")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-sku`}>{t("inventory.form.sku")}</Label>
          <Input
            id={`${id}-sku`}
            autoComplete="off"
            maxLength={64}
            placeholder={t("inventory.form.skuPlaceholder")}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="max-sm:h-10"
            {...field("sku")}
          />
          {fieldError("sku")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-unit`}>{t("inventory.form.unit")}</Label>
          <Input
            id={`${id}-unit`}
            autoComplete="off"
            maxLength={16}
            placeholder={t("inventory.form.unitPlaceholder")}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="max-sm:h-10"
            {...field("unit")}
          />
          {fieldError("unit")}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-category`}>{t("inventory.form.category")}</Label>
        <Input
          id={`${id}-category`}
          list={`${id}-categories`}
          autoComplete="off"
          maxLength={64}
          placeholder={t("inventory.form.categoryPlaceholder")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="max-sm:h-10"
        />
        <datalist id={`${id}-categories`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-safety`}>{t("inventory.form.safety")}</Label>
        <Input
          id={`${id}-safety`}
          inputMode="decimal"
          autoComplete="off"
          value={safety}
          onChange={(e) => setSafety(e.target.value)}
          className="max-sm:h-10"
          aria-invalid={errors.safety ? true : undefined}
          aria-describedby={`${id}-safety-help${errors.safety ? ` ${id}-safety-error` : ""}`}
        />
        <p id={`${id}-safety-help`} className="text-(length:--fs-sm) text-(--text-3)">
          {t("inventory.form.safetyHelp")}
        </p>
        {fieldError("safety")}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="max-sm:h-10" onClick={onDone}>
          {t("common.action.cancel")}
        </Button>
        <Button type="submit" className="max-sm:h-10" disabled={pending} aria-busy={pending}>
          {pending ? t("common.action.saving") : item ? t("inventory.form.submitSave") : t("inventory.form.submitAdd")}
        </Button>
      </DialogFooter>
    </form>
  );
}
