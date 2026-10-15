// 로그인 화면. next 쿼리를 검증해 폼에 넘기고 이메일 링크 실패 안내와 데모 버튼 표시 여부를 정한다
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { isDemoEnabled } from "@/lib/demo/config";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.login.title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, error } = await searchParams;
  const t = await getT();
  return (
    <LoginForm
      next={safeNext(typeof next === "string" ? next : null)}
      linkError={error === "link" ? t("auth.linkError") : undefined}
      demo={isDemoEnabled()}
    />
  );
}
