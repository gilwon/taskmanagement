// 루트 분기. 비로그인은 /login, 소속 워크스페이스가 있으면 그 홈, 없으면 받은 초대(/invites) 또는 /onboarding으로 보낸다(spec R1)
import { redirect } from "next/navigation";
import { isGoneSession } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";

const ROLE_RANK = { owner: 0, admin: 1, member: 2, guest: 3 } as const;

export default async function RootPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, created_at, workspaces(slug)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error("소속 워크스페이스를 불러오지 못했습니다.");

  // 기본 워크스페이스 기록이 아직 없어 규칙으로 고른다.
  // 먼저 소속된 곳 → 같은 시각이면 역할이 높은 곳(소유자 > 관리자 > 구성원 > 게스트) → slug 사전순
  const first = data
    .filter((m) => m.workspaces)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        ROLE_RANK[a.role] - ROLE_RANK[b.role] ||
        a.workspaces!.slug.localeCompare(b.workspaces!.slug),
    )[0];

  if (first) redirect(`/${first.workspaces!.slug}/home`);

  // 소속이 없으면 계정이 지워졌을 수 있다(소속은 계정과 함께 지워진다). getClaims는 JWT 서명만 보므로 Auth 서버에 확인한다
  const { error: userError } = await supabase.auth.getUser();
  if (isGoneSession(userError?.code)) redirect("/auth/signout");

  // 소속이 없어도 받은 초대가 있으면 온보딩 대신 초대 수락 화면으로 보낸다
  const invites = await supabase.rpc("my_invites");
  if (invites.error) throw new Error("받은 초대를 불러오지 못했습니다.");
  redirect(invites.data.length > 0 ? "/invites" : "/onboarding");
}
