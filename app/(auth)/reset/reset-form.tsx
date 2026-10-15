"use client";
// 새 비밀번호 두 칸을 updatePassword Server Action으로 보낸다
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { updatePassword } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/rules";

export function ResetForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(updatePassword);
  return (
    <AuthCard title="새 비밀번호 설정" description="앞으로 로그인할 때 쓸 새 비밀번호를 입력해 주세요.">
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field
          id="password"
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
          hint={`영문과 숫자를 섞어 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`}
          minLength={MIN_PASSWORD_LENGTH}
          required
          error={fieldError("password")}
        />
        <Field
          id="confirm"
          label="새 비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="한 번 더 입력"
          required
          error={fieldError("confirm")}
        />
        <SubmitButton pending={pending}>{pending ? "저장 중…" : "비밀번호 변경"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
