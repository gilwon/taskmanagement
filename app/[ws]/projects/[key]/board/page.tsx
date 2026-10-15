// 프로젝트 보드 탭. key로 프로젝트를 찾고 없으면 404. 뷰 상태는 p:{프로젝트 id} 키로 저장한다
import { ProjectTasksPage } from "@/components/tasks/project-tasks-page";
import { projectMetadata, type ProjectParams } from "@/lib/data/project";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "board");
}

export default function ProjectBoardPage({ params }: { params: ProjectParams }) {
  return <ProjectTasksPage params={params} mode="board" />;
}
