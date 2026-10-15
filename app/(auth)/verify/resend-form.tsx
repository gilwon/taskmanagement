"use client";
// 확인 메일 다시 보내기 폼. 주소를 모르면 이메일 칸을 보인다
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { resendConfirmation } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/client";

export function ResendForm({ email }: { email: string }) {
  const { state, pending, formRef, onSubmit, fieldError, formError } = useAuthAction(resendConfirmation);
  const sent = state && "ok" in state;
  const t = useT();
  return (
    <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
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
      <SubmitButton pending={pending} variant="outline">
        {pending ? t("auth.sending") : t("auth.verify.resend")}
      </SubmitButton>
    </form>
  );
}
