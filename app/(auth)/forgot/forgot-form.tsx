"use client";
// 비밀번호 재설정 메일 요청 폼
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { requestPasswordReset } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/client";

export function ForgotForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(requestPasswordReset);
  const t = useT();
  return (
    <AuthCard
      title={t("auth.forgot.title")}
      description={t("auth.forgot.description")}
      footer={
        <Link href="/login" className={linkClass}>
          {t("auth.backToLogin")}
        </Link>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field
          id="email"
          label={t("auth.field.email")}
          type="email"
          autoComplete="email"
          placeholder={t("auth.field.emailPlaceholder")}
          required
          error={fieldError("email")}
        />
        <SubmitButton pending={pending}>{pending ? t("auth.sending") : t("auth.forgot.submit")}</SubmitButton>
      </form>
    </AuthCard>
  );
}
