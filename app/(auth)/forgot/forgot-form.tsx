"use client";
// 비밀번호 재설정 메일 요청 폼
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(requestPasswordReset);
  return (
    <AuthCard
      title="비밀번호 찾기"
      description="가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내 드립니다."
      footer={
        <Link href="/login" className={linkClass}>
          로그인으로 돌아가기
        </Link>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          error={fieldError("email")}
        />
        <SubmitButton pending={pending}>{pending ? "보내는 중…" : "재설정 링크 보내기"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
