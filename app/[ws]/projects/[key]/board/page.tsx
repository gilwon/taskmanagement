// 프로젝트 보드 탭 골격. key로 프로젝트를 찾고 없으면 404
import { ProjectStubPage } from "@/components/shell/project-stub";
import { projectMetadata, type ProjectParams } from "@/lib/data/project";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "board");
}

export default function ProjectBoardPage({ params }: { params: ProjectParams }) {
  return <ProjectStubPage params={params} tab="board" />;
}
