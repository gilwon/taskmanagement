"use client";
// 확인 메일 다시 보내기 폼. 주소를 모르면 이메일 칸을 보인다
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { resendConfirmation } from "@/lib/auth/actions";

export function ResendForm({ email }: { email: string }) {
  const { state, pending, formRef, onSubmit, fieldError, formError } = useAuthAction(resendConfirmation);
  const sent = state && "ok" in state;
  return (
    <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
      <p className="text-[length:var(--fs-sm)] text-[var(--text-3)]">
        메일이 보이지 않으면 스팸함을 확인하거나 다시 보내 주세요.
      </p>
      <FormAlert message={formError} />
      <FormAlert tone="info" message={sent ? "확인 메일을 다시 보냈습니다." : undefined} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          error={fieldError("email")}
        />
      )}
      <SubmitButton pending={pending} variant="outline">
        {pending ? "보내는 중…" : "확인 메일 다시 보내기"}
      </SubmitButton>
    </form>
  );
}
