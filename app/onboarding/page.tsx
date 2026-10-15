// 온보딩 화면. 서버에서 로그인을 다시 확인한 뒤 6단계 마법사를 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { linkClass } from "@/components/auth/auth-card";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "시작하기 · 작업 공간" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/onboarding");
  // 초대받은 이메일로 가입한 사람이 새 워크스페이스 대신 초대를 수락할 수 있게 알린다. 조회 실패면 안내만 생략한다
  const invites = await supabase.rpc("my_invites");
  const invited = (invites.data?.length ?? 0) > 0;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col items-center justify-center gap-[var(--s-4)] p-[var(--gutter)] outline-none"
    >
      {invited && (
        <p className="w-full max-w-[400px] rounded-[var(--r)] bg-[var(--accent-soft)] px-[var(--s-4)] py-[var(--s-3)] text-[length:var(--fs-sm)] text-[var(--text)]">
          받은 워크스페이스 초대가 있습니다.{" "}
          <Link href="/invites" className={linkClass}>
            초대 확인하기
          </Link>
        </p>
      )}
      <OnboardingWizard />
    </main>
  );
}
