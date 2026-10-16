// 받은 초대 화면. 로그인한 사용자 이메일로 온 워크스페이스 초대를 수락·거절한다. 셸 없이 가운데 카드로 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { RouteAnnouncer } from "@/components/auth/route-announcer";
import { InvitesList } from "@/components/org/invites-list";
import { isDemoUser } from "@/lib/demo/config";
import { getT } from "@/lib/i18n/server";
import { getMyInvites } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("org.myInvites.title")} · ${t("common.appName")}` };
}

export default async function InvitesPage() {
  const t = await getT();
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
        title={t("org.myInvites.title")}
        description={t("org.myInvites.description")}
        footer={
          <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {/* 데모 계정은 워크스페이스를 만들 수 없어 진입점을 숨긴다 */}
            {!isDemoUser(data.claims) && (
              <Link href="/onboarding" className={linkClass}>
                {t("org.myInvites.newWorkspace")}
              </Link>
            )}
            {(mine.count ?? 0) > 0 && (
              <Link href="/" className={linkClass}>
                {t("org.myInvites.goToWorkspace")}
              </Link>
            )}
          </span>
        }
      >
        <InvitesList invites={invites} />
      </AuthCard>
      <RouteAnnouncer />
    </main>
  );
}
