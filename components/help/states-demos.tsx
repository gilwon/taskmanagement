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
  const [busy, start] = useFakeBusy(1500);
  return (
    <Button onClick={start} disabled={busy} aria-busy={busy}>
      {busy && <Loader2 aria-hidden strokeWidth={1.8} className={spin} />}
      {busy ? "저장 중…" : "저장"}
    </Button>
  );
}

function RetryError() {
  const [busy, start] = useFakeBusy(1200);
  return (
    <ErrorState
      action={
        <Button variant="outline" size="sm" onClick={start} disabled={busy} aria-busy={busy}>
          {busy && <Loader2 aria-hidden strokeWidth={1.8} className={spin} />}
          {busy ? "다시 시도 중…" : "다시 시도"}
        </Button>
      }
    />
  );
}

function FieldError() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>("이메일 주소를 입력해 주세요.");
  return (
    <form
      noValidate
      className="grid w-full max-w-sm gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) setError("이메일 주소를 입력해 주세요.");
        else if (!/^[^\s@]+@[^\s@]+$/.test(v)) setError("올바른 이메일 주소 형식이 아닙니다.");
        else {
          setError(null);
          toast.success("확인했습니다");
        }
      }}
    >
      <Label htmlFor="st-email">이메일</Label>
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
          확인
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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden strokeWidth={1.8} /> 영구 삭제
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>작업을 영구 삭제할까요?</DialogTitle>
          <DialogDescription>
            영구 삭제하면 되돌릴 수 없습니다. 이 작업의 댓글과 첨부 파일도 함께 삭제됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => toast("견본이라 실제로 삭제하지 않았습니다")}>
              영구 삭제
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatesDemos() {
  return (
    <>
      <ShowcaseSection id="st-busy" title="처리 중">
        <div className={row}>
          <BusyButton />
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="st-error" title="오류">
        <ShowcaseGroup title="불러오기 실패">
          <div className="rounded-(--r-lg) border border-(--border)">
            <RetryError />
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="폼 필드 오류">
          <FieldError />
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="st-confirm" title="확인·알림">
        <ShowcaseGroup title="삭제 확인">
          <DeleteConfirm />
        </ShowcaseGroup>
        <ShowcaseGroup title="토스트">
          <div className={row}>
            <Button variant="outline" onClick={() => toast("보기를 저장했습니다")}>
              기본
            </Button>
            <Button variant="outline" onClick={() => toast.success("변경 사항을 저장했습니다")}>
              성공
            </Button>
            <Button variant="outline" onClick={() => toast.error("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")}>
              오류
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast("작업을 삭제했습니다", {
                  action: { label: "실행 취소", onClick: () => toast.success("작업을 되돌렸습니다") },
                })
              }
            >
              실행 취소 포함
            </Button>
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>
    </>
  );
}
