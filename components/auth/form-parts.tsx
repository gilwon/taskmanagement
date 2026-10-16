"use client";
// 인증 폼 공용 부품. Server Action 호출 훅, 오류를 연결한 입력 칸, 폼 전체 오류, 제출 버튼
import { startTransition, useActionState, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { primaryHover } from "@/components/auth/auth-card";
import "@/components/auth/lucian-auth.css";
import type { ActionState } from "@/lib/auth/rules";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// 클래스를 뗐다 붙여 CSS 애니메이션을 처음부터 다시 돌리고, 끝나면 뗀다. 돌려주는 함수가 정리한다
function replay(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const end = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) el.classList.remove(cls);
  };
  el.addEventListener("animationend", end);
  return () => {
    el.removeEventListener("animationend", end);
    el.classList.remove(cls);
  };
}

// <form action> 대신 onSubmit으로 보낸다. React가 실패 뒤 입력값을 지우지 않게 한다
export function useAuthAction(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // 오류가 오면 첫 오류 칸으로 포커스를 옮긴다. 폼 전체 오류면 카드를 흔든다(#062). 제출마다 state가 새 객체라 같은 오류여도 다시 흔든다
  useEffect(() => {
    if (!state || !("error" in state)) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    // AuthCard는 서버 화면에서도 쓰여 클라이언트로 바꾸지 않고, 폼에서 카드를 찾아 흔든다
    const card = state.error.field ? null : formRef.current?.closest<HTMLElement>(".u062");
    return card ? replay(card, "shake") : undefined;
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

// #025 홈 라벨 입력칸. 포커스하거나 값이 있으면 라벨이 줄어 테두리 홈으로 오르고, 오류가 새로 오면 칸이 흔들리며 문구가 펼쳐진다
// type=password면 #062 눈 버튼으로 비밀번호를 보였다 숨긴다
export function Field({
  id,
  label,
  error,
  hint,
  invalidBy,
  className,
  type,
  placeholder,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  // 폼 전체 오류(틀린 자격 증명 등)가 이 칸에도 해당하면 그 오류 문구의 id
  invalidBy?: string;
}) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const labRef = useRef<HTMLLabelElement>(null);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`, invalidBy].filter(Boolean).join(" ") || undefined;
  const password = type === "password";

  // 테두리 홈 폭. 오른 라벨(0.8배) 폭에 2px을 더한다
  useLayoutEffect(() => {
    if (labRef.current) lineRef.current?.style.setProperty("--gap", `${labRef.current.offsetWidth * 0.8 + 2}px`);
  }, [label]);

  // 오류 문구가 새로 오면 칸을 흔든다
  useEffect(() => (error && boxRef.current ? replay(boxRef.current, "is-shake") : undefined), [error]);

  return (
    <div className={cn("u025-f", (error || invalidBy) && "is-bad")}>
      <div ref={boxRef} className="u025-box">
        <input
          id={id}
          name={id}
          type={password && shown ? "text" : type}
          // 빈 칸 판정(:placeholder-shown)에 쓰므로 자리 표시자가 없어도 빈칸 하나를 넣는다
          placeholder={placeholder || " "}
          aria-invalid={error || invalidBy ? true : undefined}
          aria-describedby={describedBy}
          className={cn("u025-in", className)}
          {...props}
        />
        <span ref={lineRef} className="u025-line" aria-hidden="true">
          <i className="l" />
          <i className="g" />
          <i className="r" />
        </span>
        <label ref={labRef} htmlFor={id} className="u025-lab">
          {label}
        </label>
        {password && (
          <button
            type="button"
            className="u062-eye"
            aria-pressed={shown}
            aria-controls={id}
            // 상태는 aria-pressed가 알린다. 이름까지 바꾸면 "숨기기, 눌림"처럼 두 번 읽힌다(APG)
            aria-label={t("auth.field.showPassword")}
            onClick={() => setShown(!shown)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <g className="u062-lid">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                <circle cx="12" cy="12" r="3" />
              </g>
              <path className="u062-slash" d="M4 4l16 16" />
            </svg>
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-[var(--s-2)] pl-1 text-[length:var(--fs-xs)] text-[var(--text-3)]">
          {hint}
        </p>
      )}
      <div className={cn("u025-help", error && "is-open")}>
        <span id={`${id}-error`}>{error}</span>
      </div>
    </div>
  );
}

// 폼 전체 오류·안내. 나타날 때 높이가 0에서 펼쳐진다(#062 오류 줄)
export function FormAlert({ id, message, tone = "error" }: { id?: string; message?: string; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className="u062-alert">
      <div>
        <div
          className={cn(
            "rounded-[var(--r)] px-[var(--s-3)] py-[var(--s-2)] text-[length:var(--fs-sm)]",
            tone === "error" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--green-soft)] text-[var(--green)]",
          )}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

// #062 제출 버튼. 보내는 동안 회전 원으로 줄고, 문구는 투명하게 남아 스크린리더가 읽는다
// 호출부 Tailwind 클래스(w-full 등)가 줄어드는 폭을 덮지 않도록 shadcn Button을 거치지 않는다
export function SubmitButton({
  pending,
  children,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & { pending: boolean; variant?: "default" | "outline" }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "u062-go",
        pending && "busy",
        variant === "outline" ? "u064-ghost hover:bg-[var(--surface-3)]" : primaryHover,
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <i aria-hidden="true" />
    </button>
  );
}
