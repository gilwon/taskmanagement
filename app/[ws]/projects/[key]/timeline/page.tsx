// 프로젝트 타임라인 탭 골격. key로 프로젝트를 찾고 없으면 404
import { ProjectStubPage } from "@/components/shell/project-stub";
import { projectMetadata, type ProjectParams } from "@/lib/data/project";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "timeline");
}

export default function ProjectTimelinePage({ params }: { params: ProjectParams }) {
  return <ProjectStubPage params={params} tab="timeline" />;
}
