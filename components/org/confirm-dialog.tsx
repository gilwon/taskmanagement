"use client";
// 되돌리기 어려운 조직 동작(비활성화, 팀 삭제, 워크스페이스 삭제)의 확인 대화상자. requireText가 있으면 그 값을 입력해야 실행된다
import { useState } from "react";
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

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  requireText,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  requireText?: string;
  // 실패하면 오류 문구를 돌려준다. 성공하면 null
  onConfirm: (typed: string) => Promise<string | null>;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = requireText !== undefined && typed.trim() !== requireText;

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || blocked) return;
    setBusy(true);
    const message = await onConfirm(typed.trim());
    setBusy(false);
    if (message) return setError(message);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={run} method="post" className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {requireText !== undefined && (
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-text">
                {t("org.confirm.typeBefore")} <span className="font-mono text-(--text)">{requireText}</span>{" "}
                {t("org.confirm.typeAfter")}
              </Label>
              <Input
                id="confirm-text"
                autoFocus
                autoComplete="off"
                value={typed}
                aria-describedby={error ? "confirm-error" : undefined}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setError(null);
                }}
              />
            </div>
          )}
          {error && (
            <p id="confirm-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.action.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || blocked} aria-busy={busy}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
