"use client";
// 로그인 폼. 이메일·비밀번호를 signIn Server Action으로 보내고, 데모가 켜져 있으면 데모 로그인 버튼을 둔다
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { signIn, signInDemo } from "@/lib/auth/actions";
import { DEMO_LIMIT_FIELD } from "@/lib/demo/fields";
import { useT } from "@/lib/i18n/client";

export function LoginForm({ next, linkError, demo }: { next: string; linkError?: string; demo: boolean }) {
  const { pending, formRef, onSubmit, fieldError, formError, state } = useAuthAction(signIn);
  const t = useT();
  // 제출 뒤 폼 전체 오류는 이메일·비밀번호 조합에 대한 것이라 두 칸 모두 오류로 표시하고 문구를 잇는다
  const credError = state && formError ? "login-error" : undefined;
  return (
    <AuthCard
      title={t("auth.login.title")}
      description={t("auth.login.description")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link href="/signup" className={linkClass}>
            {t("auth.login.createAccount")}
          </Link>
        </>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        {/* 제출 전에는 링크 오류를, 제출 뒤에는 그 결과만 보인다 */}
        <FormAlert id="login-error" message={state ? formError : linkError} />
        <input type="hidden" name="next" value={next} />
        <Field
          id="email"
          label={t("auth.field.email")}
          type="email"
          autoComplete="email"
          placeholder={t("auth.field.emailPlaceholder")}
          required
          error={fieldError("email")}
          invalidBy={credError}
        />
        <div className="flex flex-col gap-[var(--s-2)]">
          <Field
            id="password"
            label={t("auth.field.password")}
            type="password"
            autoComplete="current-password"
            placeholder={t("auth.field.password")}
            required
            error={fieldError("password")}
            invalidBy={credError}
          />
          <Link href="/forgot" className={`${linkClass} self-end text-[length:var(--fs-sm)]`}>
            {t("auth.login.forgot")}
          </Link>
        </div>
        <SubmitButton pending={pending}>{pending ? t("auth.login.submitting") : t("auth.login.submit")}</SubmitButton>
      </form>
      {demo && <DemoLogin />}
    </AuthCard>
  );
}

// 데모 시작. 서버가 익명 로그인과 사본 생성을 하므로 폼은 아무 값도 보내지 않는다
function DemoLogin() {
  const { state, pending, formRef, onSubmit, formError } = useAuthAction(signInDemo);
  const t = useT();
  // 익명 로그인 한도 초과는 폼 안 안내가 아니라 토스트로 알린다
  useEffect(() => {
    if (state && "error" in state && state.error.field === DEMO_LIMIT_FIELD) toast.error(state.error.message);
  }, [state]);
  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={onSubmit}
      aria-describedby="demo-note"
      className="mt-[var(--s-4)] flex flex-col gap-[var(--s-2)] border-t border-[var(--border)] pt-[var(--s-4)]"
    >
      <FormAlert id="demo-error" message={formError} />
      <SubmitButton pending={pending} variant="outline">
        {pending ? t("auth.login.demoPending") : t("auth.login.demo")}
      </SubmitButton>
      <p id="demo-note" className="whitespace-pre-line text-center text-[length:var(--fs-xs)] text-[var(--text-3)]">
        {t("auth.login.demoNote")}
      </p>
    </form>
  );
}
