// 로그인 2단계 인증 화면. 코드 확인이 필요 없는 세션은 원래 가려던 곳으로 보낸다
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "./mfa-form";
import { needsMfaStep } from "@/lib/auth/mfa";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.mfa.title") };
}

export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : null);
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!needsMfaStep(data?.currentLevel, data?.nextLevel)) redirect(target);
  return <MfaForm next={target} />;
}
