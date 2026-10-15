// 프로젝트 저장 뷰. 프로젝트와 그 프로젝트의 저장 뷰를 찾고 없으면 404. 저장된 보기 방식으로 그리고 뷰 상태는 sv:{id} 키로 저장한다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectTasksPage } from "@/components/tasks/project-tasks-page";
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
  return <ProjectTasksPage params={params} mode={view.type} savedView={{ id: vid.toLowerCase(), filters: view.filters }} />;
}
