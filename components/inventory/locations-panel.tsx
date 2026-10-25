"use client";
// 위치 탭. 위치 목록과 (관리자만) 추가·이름 변경·보관을 다룬다. 수량이 남은 위치의 보관 거부는 서버 오류 문구 그대로 보인다
import { Archive, MapPin, Pencil, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useInventory } from "@/components/inventory/use-inventory";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { createStockLocation, renameStockLocation, setStockLocationArchived } from "@/lib/inventory/actions";
import type { StockLocation } from "@/lib/inventory/types";

type Props = { workspaceId: string; locations: StockLocation[]; canManage: boolean };

// 위치 이름 입력과 추가 버튼. 목록이 비었을 때와 있을 때 같이 쓴다
function AddLocationForm({ workspaceId }: { workspaceId: string }) {
  const t = useT();
  const id = useId();
  const { run, pending } = useInventory();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) return setError(t("inventory.form.required"));
    setError(null);
    const r = await run(() => createStockLocation(workspaceId, name.trim()), t("inventory.toast.locationAdded"));
    if (r.ok) setName("");
    else if (r.error) setError(r.error);
  };

  return (
    <form onSubmit={submit} method="post" noValidate className="grid gap-1.5">
      <Label htmlFor={`${id}-name`} className="sr-only">
        {t("inventory.locations.addLabel")}
      </Label>
      <div className="flex gap-2">
        <Input
          id={`${id}-name`}
          autoComplete="off"
          maxLength={80}
          placeholder={t("inventory.locations.addPlaceholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-(--h-md) max-w-xs flex-1 max-sm:h-10"
        />
        <Button type="submit" disabled={pending} aria-busy={pending} className="max-sm:h-10">
          <Plus aria-hidden strokeWidth={1.8} />
          {t("inventory.locations.add")}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-(length:--fs-sm) text-(--red)">
          {error}
        </p>
      )}
    </form>
  );
}

function RenameDialog({ location, onClose }: { location: StockLocation; onClose: () => void }) {
  const t = useT();
  const id = useId();
  const { run, pending } = useInventory();
  const [name, setName] = useState(location.name);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) return setError(t("inventory.form.required"));
    setError(null);
    const r = await run(() => renameStockLocation(location.id, name.trim()), t("inventory.toast.locationRenamed"));
    if (r.ok) onClose();
    else if (r.error) setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} method="post" noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("inventory.locations.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>{t("inventory.locations.renameLabel")}</Label>
            <Input
              id={`${id}-name`}
              autoFocus
              autoComplete="off"
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="max-sm:h-10"
            />
            {error && (
              <p id={`${id}-error`} role="alert" className="text-(length:--fs-sm) text-(--red)">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="max-sm:h-10" onClick={onClose}>
              {t("common.action.cancel")}
            </Button>
            <Button type="submit" className="max-sm:h-10" disabled={pending} aria-busy={pending}>
              {pending ? t("common.action.saving") : t("common.action.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationsPanel({ workspaceId, locations, canManage }: Props) {
  const t = useT();
  const { run } = useInventory();
  const [renaming, setRenaming] = useState<StockLocation | null>(null);
  const [archiving, setArchiving] = useState<StockLocation | null>(null);

  if (locations.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title={t("inventory.locations.emptyTitle")}
        description={canManage ? t("inventory.locations.emptyDescription") : t("inventory.locations.emptyRequest")}
        action={canManage && <AddLocationForm workspaceId={workspaceId} />}
      />
    );
  }

  return (
    <div className="grid gap-(--s-4) px-(--gutter)">
      {canManage && <AddLocationForm workspaceId={workspaceId} />}
      <ul aria-label={t("inventory.locations.listLabel")} className="divide-y divide-(--border) rounded-(--r-sm) border border-(--border)">
        {locations.map((l) => (
          <li
            key={l.id}
            className="flex min-h-(--row-h) items-center gap-2 px-3 py-1 transition-colors ease-(--ux-ease) hover:bg-muted/50 max-sm:min-h-12"
          >
            <MapPin aria-hidden size={14} strokeWidth={1.8} className="shrink-0 text-(--text-3)" />
            <span className="min-w-0 flex-1 truncate text-(length:--fs-base) font-medium text-(--text)">{l.name}</span>
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-sm:h-10 max-sm:min-w-10"
                  aria-label={`${t("inventory.locations.rename")}: ${l.name}`}
                  onClick={() => setRenaming(l)}
                >
                  <Pencil aria-hidden strokeWidth={1.8} />
                  <span className="max-sm:sr-only">{t("inventory.locations.rename")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-sm:h-10 max-sm:min-w-10"
                  aria-label={`${t("inventory.locations.archive")}: ${l.name}`}
                  onClick={() => setArchiving(l)}
                >
                  <Archive aria-hidden strokeWidth={1.8} />
                  <span className="max-sm:sr-only">{t("inventory.locations.archive")}</span>
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      {renaming && <RenameDialog key={renaming.id} location={renaming} onClose={() => setRenaming(null)} />}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t("inventory.locations.archiveTitle")}
        description={t("inventory.locations.archiveDescription", { name: archiving?.name ?? "" })}
        confirmLabel={t("inventory.locations.archive")}
        onConfirm={async () => {
          if (!archiving) return null;
          const r = await run(() => setStockLocationArchived(archiving.id, true), t("inventory.toast.locationArchived"));
          return r.ok ? null : r.error || null;
        }}
      />
    </div>
  );
}
