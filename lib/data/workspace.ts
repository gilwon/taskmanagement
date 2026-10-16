// 셸·라우트 골격용 서버 조회. 같은 요청 안의 layout·generateMetadata·page가 결과를 나눠 쓰도록 cache로 감싼다
import { cache } from "react";
import { redirect } from "next/navigation";
import { SLUG_RE } from "@/lib/auth/rules";
import { orderProjects } from "@/lib/data/project-order";
import type { Enums } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// 형식이 틀린 id로 조회하면 Postgres가 22P02 오류를 내므로 조회 전에 거른다
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DB 오류를 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
function fail(what: string, error: { message: string }): never {
  console.error(`[${what}]`, error.message);
  throw new Error(`${what}을(를) 불러오지 못했습니다.`);
}

// 검증된 클레임의 사용자 id. 없으면 로그인으로 보낸다
export const requireUserId = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect("/login");
  return sub;
});

// RLS(is_ws_member)가 활성 소속 워크스페이스만 돌려준다
export const getWorkspace = cache(async (slug: string) => {
  if (!SLUG_RE.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, slug, name, color")
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("워크스페이스", error);
  return data;
});

export const getProject = cache(async (workspaceId: string, key: string) => {
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, key, name, icon, color, status, access")
    .eq("workspace_id", workspaceId)
    .eq("key", key)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("프로젝트", error);
  return data;
});

// 아래 셋은 상세 라우트용 조회. 워크스페이스 slug와 URL 값으로 찾고, 없거나 형식이 틀리면 null(404)

// 프로젝트 키가 워크스페이스 안에서 유일하므로 작업 키(WEB-112)도 워크스페이스 안에서 유일하다
export const getTask = cache(async (ws: string, rawKey: string) => {
  const key = decodeURIComponent(rawKey);
  const workspace = await getWorkspace(ws);
  if (!workspace || !/^[A-Z][A-Z0-9]{0,9}-\d+$/.test(key)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("key, title")
    .eq("workspace_id", workspace.id)
    .eq("key", key)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("작업", error);
  return data;
});

export const getMember = cache(async (ws: string, userId: string) => {
  const workspace = await getWorkspace(ws);
  if (!workspace || !UUID_RE.test(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, title, profiles(name)")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("구성원", error);
  return data;
});

export const getTeam = cache(async (ws: string, teamId: string) => {
  const workspace = await getWorkspace(ws);
  if (!workspace || !UUID_RE.test(teamId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("name, description")
    .eq("workspace_id", workspace.id)
    .eq("id", teamId)
    .maybeSingle();
  if (error) fail("팀", error);
  return data;
});

export const getSavedView = cache(async (projectId: string, viewId: string) => {
  if (!UUID_RE.test(viewId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .select("name, type, filters")
    .eq("id", viewId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) fail("저장 뷰", error);
  return data;
});

export type ShellProject = {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  status: Enums<"project_status">;
  access: Enums<"project_access">;
  favorite: boolean;
};

export type ShellData = {
  workspace: { id: string; slug: string; name: string; color: string };
  workspaces: { id: string; slug: string; name: string; color: string }[];
  projects: ShellProject[];
  teams: { id: string; name: string; icon: string; color: string }[];
  counts: { unread: number; myOpenTasks: number };
  // role은 메뉴 숨김용. 실제 권한은 RLS와 서버 함수가 판단한다
  me: { id: string; name: string; email: string; color: string; role: Enums<"ws_role"> | null };
};

// 사이드바·탑바가 쓰는 데이터를 한 번에 읽는다. 범위는 RLS가 자른다
export async function getShellData(
  workspace: ShellData["workspace"],
  userId: string,
): Promise<ShellData> {
  const [supabase, t] = await Promise.all([createClient(), getT()]);
  const [workspaces, projects, favorites, teams, unread, myOpen, profile, membership, prefs] = await Promise.all([
    supabase.from("workspaces").select("id, slug, name, color").order("name"),
    // 이름순으로 읽고 아래에서 사용자별 순서(user_prefs.proj_order)로 다시 놓는다
    supabase
      .from("projects")
      .select("id, key, name, icon, color, status, access")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("favorites")
      .select("project_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .not("project_id", "is", null),
    supabase.from("teams").select("id, name, icon, color").eq("workspace_id", workspace.id).order("name"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .is("read_at", null),
    // 홈 "내 담당" 숫자와 같은 기준. 삭제·보관된 프로젝트의 작업은 세지 않는다
    supabase
      .from("tasks")
      .select("id, project:projects!tasks_project_id_workspace_id_fkey!inner(id)", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("assignee_id", userId)
      .neq("status", "done")
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("project.deleted_at", null)
      .is("project.archived_at", null),
    supabase.from("profiles").select("name, email, color").eq("id", userId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("color, role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_prefs")
      .select("proj_order")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (workspaces.error) fail("워크스페이스 목록", workspaces.error);
  if (projects.error) fail("프로젝트 목록", projects.error);
  if (favorites.error) fail("즐겨찾기", favorites.error);
  if (teams.error) fail("팀 목록", teams.error);
  if (unread.error) fail("알림 개수", unread.error);
  if (myOpen.error) fail("내 작업 개수", myOpen.error);
  if (profile.error) fail("프로필", profile.error);
  if (membership.error) fail("구성원 정보", membership.error);
  if (prefs.error) fail("사용자 설정", prefs.error);

  const favIds = new Set(favorites.data.map((f) => f.project_id));
  return {
    workspace,
    workspaces: workspaces.data,
    projects: orderProjects(projects.data, prefs.data?.proj_order ?? []).map((p) => ({ ...p, favorite: favIds.has(p.id) })),
    teams: teams.data,
    counts: { unread: unread.count ?? 0, myOpenTasks: myOpen.count ?? 0 },
    me: {
      id: userId,
      name: profile.data?.name || profile.data?.email || t("common.me"),
      email: profile.data?.email ?? "",
      color: membership.data?.color ?? profile.data?.color ?? "indigo",
      role: membership.data?.role ?? null,
    },
  };
}
