"use client";
// 인증 폼 공용 부품. Server Action 호출 훅, 오류를 연결한 입력 칸, 폼 전체 오류, 제출 버튼
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { buttonClass, primaryHover } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/rules";
import { cn } from "@/lib/utils";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// <form action> 대신 onSubmit으로 보낸다. React가 실패 뒤 입력값을 지우지 않게 한다
export function useAuthAction(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // 오류가 오면 첫 오류 칸으로 포커스를 옮긴다
  useEffect(() => {
    if (state && "error" in state) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const error = state && "error" in state ? state.error : null;
  return {
    state,
    pending,
    formRef,
    onSubmit,
    fieldError: (field: string) => (error?.field === field ? error.message : undefined),
    formError: error && !error.field ? error.message : undefined,
  };
}

export function Field({
  id,
  label,
  error,
  hint,
  invalidBy,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  // 폼 전체 오류(틀린 자격 증명 등)가 이 칸에도 해당하면 그 오류 문구의 id
  invalidBy?: string;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`, invalidBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-[var(--s-2)]">
      <Label htmlFor={id} className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error || invalidBy ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-[var(--h-lg)] rounded-[var(--r)] bg-[var(--surface)] text-[length:var(--fs-base)] md:text-[length:var(--fs-base)]",
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[length:var(--fs-xs)] text-[var(--text-3)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[length:var(--fs-xs)] text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({ id, message, tone = "error" }: { id?: string; message?: string; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--r)] px-[var(--s-3)] py-[var(--s-2)] text-[length:var(--fs-sm)]",
        tone === "error" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--green-soft)] text-[var(--green)]",
      )}
    >
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      variant={variant}
      className={cn(buttonClass, (!variant || variant === "default") && primaryHover, className)}
      {...props}
    >
      {children}
    </Button>
  );
}
