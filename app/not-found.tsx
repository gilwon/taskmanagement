// 앱 전체 404. 없는 경로와 소속이 아닌 워크스페이스 slug가 여기로 온다
import { RootNotFoundView } from "@/components/shell/root-not-found-view";
import type { NotFoundCandidate } from "@/components/shell/not-found-card";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// 로그인한 사용자의 소속 워크스페이스. 세션이 없거나 조회가 실패하면 빈 목록이라 404 화면은 그대로 뜬다
async function myWorkspaces() {
  try {
    const supabase = await createClient();
    // 세션이 없으면 조회하지 않아 이름이 새지 않는다(getClaims는 JWT 서명을 검증한다)
    const { data: auth } = await supabase.auth.getClaims();
    if (!auth?.claims?.sub) return [];
    // RLS(workspaces_select, is_ws_member)가 소속 워크스페이스만 돌려준다
    const { data, error } = await supabase.from("workspaces").select("slug, name").order("name");
    return error ? [] : data;
  } catch {
    return [];
  }
}

export default async function NotFound() {
  const t = await getT();
  const workspaces = await myWorkspaces();
  // 워크스페이스가 없으면 지금처럼 "/" 하나만 보인다
  const candidates: NotFoundCandidate[] = workspaces.length
    ? workspaces.map((w) => ({ href: `/${w.slug}/home`, name: w.name, compare: `/${w.slug}` }))
    : [{ href: "/", name: t("common.action.home") }];
  return (
    <RootNotFoundView
      title={t("errors.notFound.title")}
      description={t("errors.notFound.workspace")}
      candidates={candidates}
      similar={workspaces.length > 0}
    />
  );
}
