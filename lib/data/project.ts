// 프로젝트 하위 라우트용 조회와 문서 제목. key로 프로젝트를 찾고 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, getWorkspace } from "@/lib/data/workspace";
import { PROJECT_TAB_LABELS, type ProjectTab } from "@/lib/i18n/labels";

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
  return { title: `${project.name} ${tab === "view" ? "저장 뷰" : PROJECT_TAB_LABELS[tab]}` };
}
