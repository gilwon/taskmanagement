"use client";
// 화면 상태 견본 중 상호작용이 필요한 것(처리 중 버튼·재시도 오류·폼 오류·삭제 확인·토스트) 모음
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ShowcaseGroup, ShowcaseSection } from "@/components/help/showcase-section";
import { ErrorState } from "@/components/shell/error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";

const row = "flex flex-wrap items-center gap-(--s-3)";
const spin = "animate-[spin_.7s_linear_infinite]";

// 누르면 정해진 시간 동안 처리 중 상태가 되는 견본용 상태. 화면을 떠나면 타이머를 지운다
function useFakeBusy(ms: number) {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const start = () => {
    setBusy(true);
    timer.current = setTimeout(() => setBusy(false), ms);
  };
  return [busy, start] as const;
}

function BusyButton() {
  const t = useT();
  const [busy, start] = useFakeBusy(1500);
  return (
    <Button onClick={start} disabled={busy} aria-busy={busy}>
      {busy && <Loader2 aria-hidden strokeWidth={1.8} className={spin} />}
      {busy ? t("common.action.saving") : t("common.action.save")}
    </Button>
  );
}

function RetryError() {
  const t = useT();
  const [busy, start] = useFakeBusy(1200);
  return (
    <ErrorState
      action={
        <Button variant="outline" size="sm" onClick={start} disabled={busy} aria-busy={busy}>
          {busy && <Loader2 aria-hidden strokeWidth={1.8} className={spin} />}
          {busy ? t("help.states.retrying") : t("common.action.retry")}
        </Button>
      }
    />
  );
}

function FieldError() {
  const t = useT();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(t("help.states.emailRequired"));
  return (
    <form
      noValidate
      className="grid w-full max-w-sm gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) setError(t("help.states.emailRequired"));
        else if (!/^[^\s@]+@[^\s@]+$/.test(v)) setError(t("help.states.emailInvalid"));
        else {
          setError(null);
          toast.success(t("help.states.checked"));
        }
      }}
    >
      <Label htmlFor="st-email">{t("help.states.email")}</Label>
      <div className="flex gap-(--s-2)">
        <Input
          id="st-email"
          type="email"
          value={value}
          placeholder="name@example.com"
          aria-invalid={!!error}
          aria-describedby={error ? "st-email-error" : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="outline">
          {t("help.states.confirm")}
        </Button>
      </div>
      {error && (
        <p id="st-email-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
          {error}
        </p>
      )}
    </form>
  );
}

function DeleteConfirm() {
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden strokeWidth={1.8} /> {t("help.states.deleteForever")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("help.states.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("help.states.deleteDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.action.cancel")}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => toast(t("help.states.notReallyDeleted"))}>
              {t("help.states.deleteForever")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatesDemos() {
  const t = useT();
  return (
    <>
      <ShowcaseSection id="st-busy" title={t("help.states.busy")}>
        <div className={row}>
          <BusyButton />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="st-error" title={t("help.states.error")}>
        <ShowcaseGroup title={t("help.states.loadFailed")}>
          <div className="rounded-(--r-lg) border border-(--border)">
            <RetryError />
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title={t("help.states.fieldError")}>
          <FieldError />
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="st-confirm" title={t("help.states.confirmAndToast")}>
        <ShowcaseGroup title={t("help.states.deleteConfirm")}>
          <DeleteConfirm />
        </ShowcaseGroup>
        <ShowcaseGroup title={t("help.states.toast")}>
          <div className={row}>
            <Button variant="outline" onClick={() => toast(t("help.states.viewSaved"))}>
              {t("help.states.toastDefault")}
            </Button>
            <Button variant="outline" onClick={() => toast.success(t("help.states.changesSaved"))}>
              {t("help.states.toastSuccess")}
            </Button>
            <Button variant="outline" onClick={() => toast.error(t("help.states.saveFailed"))}>
              {t("help.states.toastError")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast(t("help.states.taskDeleted"), {
                  action: { label: t("help.states.undo"), onClick: () => toast.success(t("help.states.taskRestored")) },
                })
              }
            >
              {t("help.states.withUndo")}
            </Button>
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>
    </>
  );
}
