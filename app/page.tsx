// 루트 분기. 비로그인은 /login, 소속 워크스페이스가 있으면 그 홈, 없으면 /onboarding으로 보낸다(spec R1)
import { redirect } from "next/navigation";
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

  redirect(first ? `/${first.workspaces!.slug}/home` : "/onboarding");
}
