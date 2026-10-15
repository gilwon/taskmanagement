// 프로젝트 캘린더 탭 골격. key로 프로젝트를 찾고 없으면 404
import { ProjectStubPage } from "@/components/shell/project-stub";
import { projectMetadata, type ProjectParams } from "@/lib/data/project";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "calendar");
}

export default function ProjectCalendarPage({ params }: { params: ProjectParams }) {
  return <ProjectStubPage params={params} tab="calendar" />;
}
