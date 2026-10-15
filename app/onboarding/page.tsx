// 온보딩 화면. 서버에서 로그인을 다시 확인한 뒤 6단계 마법사를 보인다
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "시작하기 · 작업 공간" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/onboarding");

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-[var(--gutter)] outline-none">
      <OnboardingWizard />
    </main>
  );
}
