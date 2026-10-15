"use client";
// 가입 폼. 이름·이메일·비밀번호를 signUp Server Action으로 보낸다
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { signUp } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/rules";

export function SignupForm() {
  const { pending, formRef, onSubmit, fieldError, formError } = useAuthAction(signUp);
  return (
    <AuthCard
      title="계정 만들기"
      description="이메일로 가입하고 팀의 작업을 한곳에서 관리하세요."
      footer={
        <>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className={linkClass}>
            로그인
          </Link>
        </>
      }
    >
      <form ref={formRef} method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-[var(--s-4)]">
        <FormAlert message={formError} />
        <Field id="name" label="이름" autoComplete="name" placeholder="홍길동" required error={fieldError("name")} />
        <Field
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          error={fieldError("email")}
        />
        <Field
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
          hint={`${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`}
          minLength={MIN_PASSWORD_LENGTH}
          required
          error={fieldError("password")}
        />
        <SubmitButton pending={pending}>{pending ? "가입 중…" : "가입하기"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
