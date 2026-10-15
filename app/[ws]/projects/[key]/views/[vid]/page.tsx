// 프로젝트 저장 뷰 골격. 프로젝트와 그 프로젝트의 저장 뷰를 찾고 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { loadProject, projectMetadata } from "@/lib/data/project";
import { getSavedView } from "@/lib/data/workspace";

type Params = Promise<{ ws: string; key: string; vid: string }>;

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return projectMetadata(params, "view");
}

export default async function SavedViewPage({ params }: { params: Params }) {
  const { vid } = await params;
  const project = await loadProject(params);
  const view = await getSavedView(project.id, vid);
  if (!view) notFound();
  return <StubPage title={project.name} subtitle={`저장 뷰 · ${view.name}`} />;
}
