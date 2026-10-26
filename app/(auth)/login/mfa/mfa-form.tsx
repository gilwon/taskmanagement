"use client";
// 2단계 인증 코드 폼. 6자리 코드를 verifyMfa Server Action으로 보내고 로그아웃 버튼을 둔다
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { signOut, verifyMfa } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/client";

export function MfaForm({ next }: { next: string }) {
  const { pending, formRef, onSubmit, fieldError, formError, state } = useAuthAction(verifyMfa);
  const t = useT();
  return (
    <AuthCard
      title={t("auth.mfa.title")}
      description={t("auth.mfa.description")}
      footer={
        // aal1 세션을 끝내고 /login으로 돌아간다
        <form action={signOut}>
          <button type="submit" className={linkClass}>
            {t("auth.mfa.signOut")}
          </button>
        </form>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert id="mfa-error" message={state ? formError : undefined} />
        <input type="hidden" name="next" value={next} />
        <Field
          id="code"
          label={t("auth.mfa.code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          autoFocus
          required
          error={fieldError("code")}
        />
        <SubmitButton pending={pending}>{pending ? t("auth.mfa.submitting") : t("auth.mfa.submit")}</SubmitButton>
      </form>
    </AuthCard>
  );
}
