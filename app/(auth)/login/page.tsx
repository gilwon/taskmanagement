// 로그인 화면. next 쿼리를 검증해 폼에 넘기고 이메일 링크 실패 안내와 데모 버튼 표시 여부를 정한다
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { isDemoEnabled } from "@/lib/demo/config";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={safeNext(typeof next === "string" ? next : null)}
      linkError={error === "link" ? "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요." : undefined}
      demo={isDemoEnabled()}
    />
  );
}
