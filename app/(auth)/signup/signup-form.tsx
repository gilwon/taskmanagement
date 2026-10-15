"use client";
// 가입 폼. 이름·이메일·비밀번호를 signUp Server Action으로 보낸다
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { signUp } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/rules";
import { useT } from "@/lib/i18n/client";

export function SignupForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(signUp);
  const t = useT();
  return (
    <AuthCard
      title={t("auth.signup.title")}
      description={t("auth.signup.description")}
      footer={
        <>
          {t("auth.signup.haveAccount")}{" "}
          <Link href="/login" className={linkClass}>
            {t("auth.signup.login")}
          </Link>
        </>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field
          id="name"
          label={t("auth.field.name")}
          autoComplete="name"
          placeholder={t("auth.field.namePlaceholder")}
          required
          error={fieldError("name")}
        />
        <Field
          id="email"
          label={t("auth.field.email")}
          type="email"
          autoComplete="email"
          placeholder={t("auth.field.emailPlaceholder")}
          required
          error={fieldError("email")}
        />
        <Field
          id="password"
          label={t("auth.field.password")}
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.field.passwordMin", { min: MIN_PASSWORD_LENGTH })}
          hint={t("auth.field.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          minLength={MIN_PASSWORD_LENGTH}
          required
          error={fieldError("password")}
        />
        <SubmitButton pending={pending}>{pending ? t("auth.signup.submitting") : t("auth.signup.submit")}</SubmitButton>
      </form>
    </AuthCard>
  );
}
