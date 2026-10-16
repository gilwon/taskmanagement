"use client";
// 프로젝트 탭 끝의 "+ 저장 뷰" 버튼과 이름·보기 방식 입력 다이얼로그. 만든 뒤 새 저장 뷰로 이동한다
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Enums } from "@/lib/database.types";
import { useT } from "@/lib/i18n/client";
import { useCurrentView } from "@/components/tasks/views/current-view";
import { createSavedView } from "@/lib/tasks/saved-views";

type ViewType = Enums<"view_type">;
const TYPES: readonly ViewType[] = ["list", "board", "table"];

export function SaveViewDialog({
  workspaceId,
  projectId,
  baseHref,
  defaultType,
}: {
  workspaceId: string;
  projectId: string;
  // /{ws}/projects/{key}
  baseHref: string;
  defaultType: ViewType;
}) {
  const t = useT();
  const router = useRouter();
  const currentViewRef = useCurrentView();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ViewType>(defaultType);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(t("tasks.savedView.nameRequired"));
    setBusy(true);
    // 화면 메모리의 최신 상태를 넘기므로 디바운스 중인 DB 저장을 기다리지 않아도 된다. 골격 탭(작업 뷰 없음)은 필터 없이 만든다
    const r = await createSavedView(workspaceId, projectId, name, type, currentViewRef?.current?.filters ?? []);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.push(`${baseHref}/views/${r.data.id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName("");
          setType(defaultType);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("tasks.savedView.create")}
          className="inline-flex h-(--h-sm) shrink-0 items-center gap-1 self-center rounded-(--r-xs) px-1.5 text-(length:--fs-sm) text-(--text-3) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <Plus aria-hidden size={14} strokeWidth={1.8} />
          <span className="hide-m">{t("tasks.savedView.short")}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} method="post" className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("tasks.savedView.create")}</DialogTitle>
            <DialogDescription>{t("tasks.savedView.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="saved-view-name">{t("tasks.savedView.name")}</Label>
            <Input
              id="saved-view-name"
              autoFocus
              value={name}
              maxLength={80}
              placeholder={t("tasks.savedView.namePlaceholder")}
              aria-invalid={!!error}
              aria-describedby={error ? "saved-view-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="saved-view-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
                {error}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <span id="saved-view-type" className="text-(length:--fs-sm) font-medium">
              {t("tasks.savedView.type")}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={type}
              aria-labelledby="saved-view-type"
              onValueChange={(v) => v && setType(v as ViewType)}
            >
              {TYPES.map((v) => (
                <ToggleGroupItem key={v} value={v} className="px-3">
                  {t(`common.nav.${v}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.action.cancel")}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {t("tasks.savedView.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
