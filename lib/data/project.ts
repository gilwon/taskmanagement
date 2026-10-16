// 프로젝트 하위 라우트용 조회와 문서 제목. key로 프로젝트를 찾고 없으면 404. 헤더·작업 화면용 보조 조회도 둔다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getProject, getWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTab } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";

export type ProjectParams = Promise<{ ws: string; key: string }>;

// 레이아웃이 소속을 확인한 뒤라 워크스페이스는 있다. 직접 호출돼도 안전하게 다시 확인한다
export async function loadProject(params: ProjectParams) {
  const { ws, key } = await params;
  const workspace = await getWorkspace(ws);
  if (!workspace) notFound();
  const project = await getProject(workspace.id, decodeURIComponent(key));
  if (!project) notFound();
  return project;
}

// 문서 제목은 "{프로젝트} {탭} · {워크스페이스}". 뒤쪽은 [ws] 레이아웃의 title.template이 붙인다
export async function projectMetadata(params: ProjectParams, tab: ProjectTab | "view"): Promise<Metadata> {
  const { ws, key } = await params;
  const workspace = await getWorkspace(ws);
  const project = workspace && (await getProject(workspace.id, decodeURIComponent(key)));
  if (!project) return {};
  const t = await getT();
  return { title: `${project.name} ${tab === "view" ? t("org.data.savedView") : t(`common.projectTab.${tab}`)}` };
}

// 프로젝트 헤더용. 구성원 아바타, 즐겨찾기 여부, 저장 뷰 탭 목록
export const getProjectHeader = cache(async (projectId: string, userId: string) => {
  const [supabase, t] = await Promise.all([createClient(), getT()]);
  const [members, favorite, views] = await Promise.all([
    supabase.from("project_members").select("user_id, profiles(name, email, color)").eq("project_id", projectId),
    supabase.from("favorites").select("id").eq("user_id", userId).eq("project_id", projectId).maybeSingle(),
    supabase.from("saved_views").select("id, name, type").eq("project_id", projectId).order("created_at"),
  ]);
  // DB 오류를 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  if (members.error || favorite.error || views.error) {
    console.error("[프로젝트 헤더]", (members.error ?? favorite.error ?? views.error)!.message);
    throw new Error("프로젝트 정보를 불러오지 못했습니다.");
  }
  return {
    members: members.data.map((m) => ({
      id: m.user_id,
      name: m.profiles?.name || m.profiles?.email || t("common.namelessMember"),
      color: m.profiles?.color ?? "indigo",
    })),
    favorite: !!favorite.data,
    savedViews: views.data,
  };
});

// 작업 화면 컴포저의 프로젝트 선택과 부제 개수용. 삭제·보관된 프로젝트는 뺀다
export const getWorkspaceProjects = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, key, name, color, icon")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("name");
  if (error) {
    console.error("[프로젝트 목록]", error.message);
    throw new Error("프로젝트 목록을 불러오지 못했습니다.");
  }
  return data;
});

// 사용자 뷰 설정 행이 있는지. 저장 뷰를 처음 여는지(저장된 필터로 시작) 가린다. RLS가 본인 행만 보인다
export async function hasViewState(workspaceId: string, viewKey: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_view_states")
    .select("view_key", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("view_key", viewKey);
  if (error) {
    console.error("[뷰 설정 확인]", error.message);
    throw new Error("뷰 설정을 불러오지 못했습니다.");
  }
  return (count ?? 0) > 0;
}
