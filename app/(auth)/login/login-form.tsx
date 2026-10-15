"use client";
// 로그인 폼. 이메일·비밀번호를 signIn Server Action으로 보낸다
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton, useAuthAction } from "@/components/auth/form-parts";
import { signIn } from "@/lib/auth/actions";

export function LoginForm({ next, linkError }: { next: string; linkError?: string }) {
  const { pending, formRef, onSubmit, fieldError, formError, state } = useAuthAction(signIn);
  // 제출 뒤 폼 전체 오류는 이메일·비밀번호 조합에 대한 것이라 두 칸 모두 오류로 표시하고 문구를 잇는다
  const credError = state && formError ? "login-error" : undefined;
  return (
    <AuthCard
      title="로그인"
      description="작업 공간에 다시 오신 것을 환영합니다."
      footer={
        <>
          계정이 없으신가요?{" "}
          <Link href="/signup" className={linkClass}>
            계정 만들기
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
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          error={fieldError("email")}
          invalidBy={credError}
        />
        <div className="flex flex-col gap-[var(--s-2)]">
          <Field
            id="password"
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            required
            error={fieldError("password")}
            invalidBy={credError}
          />
          <Link href="/forgot" className={`${linkClass} self-end text-[length:var(--fs-sm)]`}>
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        <SubmitButton pending={pending}>{pending ? "로그인 중…" : "로그인"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
