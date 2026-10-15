"use client";
// 새 비밀번호 두 칸을 updatePassword Server Action으로 보낸다
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { updatePassword } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/rules";
import { useT } from "@/lib/i18n/client";

export function ResetForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(updatePassword);
  const t = useT();
  return (
    <AuthCard title={t("auth.reset.title")} description={t("auth.reset.description")}>
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field
          id="password"
          label={t("auth.reset.newPassword")}
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.field.passwordMin", { min: MIN_PASSWORD_LENGTH })}
          hint={t("auth.field.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          minLength={MIN_PASSWORD_LENGTH}
          required
          error={fieldError("password")}
        />
        <Field
          id="confirm"
          label={t("auth.reset.confirm")}
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.reset.confirmPlaceholder")}
          required
          error={fieldError("confirm")}
        />
        <SubmitButton pending={pending}>{pending ? t("auth.reset.submitting") : t("auth.reset.submit")}</SubmitButton>
      </form>
    </AuthCard>
  );
}
