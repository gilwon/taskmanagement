"use client";
// 확인 메일 다시 보내기 폼. 주소를 모르면 이메일 칸을 보인다. 보낸 뒤 60초는 링이 차는 동안 잠근다(#064)
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { resendConfirmation } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/client";
import { motionOff } from "@/lib/prefs/prefs";

// 다시 보내기 잠금 시간(초)
const WAIT = 60;

export function ResendForm({ email }: { email: string }) {
  const { state, pending, formRef, onSubmit, fieldError, formError } = useAuthAction(resendConfirmation);
  const sent = state && "ok" in state;
  const t = useT();
  // 처음에는 잠그지 않는다(바로 누를 수 있다)
  const [left, setLeft] = useState(0);
  const ringRef = useRef<SVGSVGElement>(null);

  // 다시 보내기에 성공했을 때만 잠금을 건다. 오류 응답은 잠그지 않는다
  useEffect(() => {
    if (!state || !("ok" in state)) return;
    const t0 = performance.now();
    const still = motionOff();
    let raf = 0;
    const step = (now: number) => {
      const el = (now - t0) / 1000;
      const rest = Math.max(0, Math.ceil(WAIT - el));
      // 모션이 꺼져 있으면 잠긴 동안 빈 링, 풀리면 찬 링으로 두 상태만 보인다
      const p = still ? (rest ? 0 : 1) : Math.min(1, el / WAIT);
      ringRef.current?.style.setProperty("--p", p.toFixed(3));
      setLeft(rest);
      if (rest) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // 잠긴 동안에는 버튼이 포커스와 남은 시간 안내를 유지하도록 disabled 대신 aria-disabled로 막는다
  function guard(event: FormEvent<HTMLFormElement>) {
    if (left > 0) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  return (
    <form ref={formRef} method="post" onSubmit={guard} noValidate className="flex flex-col gap-[var(--s-4)]">
      <p className="text-[length:var(--fs-sm)] text-[var(--text-3)]">
        {t("auth.verify.spamHint")}
      </p>
      <FormAlert message={formError} />
      <FormAlert tone="info" message={sent ? t("auth.verify.resent") : undefined} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field
          id="email"
          label={t("auth.field.email")}
          type="email"
          autoComplete="email"
          placeholder={t("auth.field.emailPlaceholder")}
          required
          error={fieldError("email")}
        />
      )}
      <SubmitButton pending={pending} variant="outline" aria-disabled={left > 0 || undefined}>
        {/* 잠기지 않은 처음 상태는 원본 #064의 잠금 해제 모양처럼 찬 링이다. 잠금 중에는 effect가 --p를 직접 쓴다 */}
        <svg
          ref={ringRef}
          className="u064-ring"
          viewBox="0 0 20 20"
          aria-hidden="true"
          style={{ "--p": 1 } as React.CSSProperties}
        >
          <circle className="t" cx="10" cy="10" r="8" />
          <circle className="p" cx="10" cy="10" r="8" pathLength="100" />
        </svg>
        {pending ? t("auth.sending") : left > 0 ? t("auth.verify.resendIn", { s: left }) : t("auth.verify.resend")}
      </SubmitButton>
    </form>
  );
}
