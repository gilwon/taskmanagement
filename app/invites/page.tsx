// 받은 초대 화면. 로그인한 사용자 이메일로 온 워크스페이스 초대를 수락·거절한다. 셸 없이 가운데 카드로 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { InvitesList } from "@/components/org/invites-list";
import { getMyInvites } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "받은 초대 · 작업 공간" };

export default async function InvitesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/invites");
  const [invites, mine] = await Promise.all([
    getMyInvites(),
    supabase.from("workspace_members").select("workspace_id", { count: "exact", head: true }).eq("user_id", data.claims.sub).eq("status", "active"),
  ]);
  if (mine.error) throw new Error("소속 워크스페이스를 불러오지 못했습니다.");

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-(--gutter) outline-none">
      <AuthCard
        title="받은 초대"
        description="이 계정의 이메일로 온 워크스페이스 초대입니다."
        footer={
          <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/onboarding" className={linkClass}>
              새 워크스페이스 만들기
            </Link>
            {(mine.count ?? 0) > 0 && (
              <Link href="/" className={linkClass}>
                내 워크스페이스로 가기
              </Link>
            )}
          </span>
        }
      >
        <InvitesList invites={invites} />
      </AuthCard>
    </main>
  );
}
