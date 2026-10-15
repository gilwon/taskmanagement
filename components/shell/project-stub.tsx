// 프로젝트 하위 탭 골격 화면. 프로젝트 이름과 탭을 머리말로 보이고 안내를 띄운다
import { StubPage } from "@/components/shell/stub-page";
import { loadProject, type ProjectParams } from "@/lib/data/project";
import { PROJECT_TAB_LABELS, type ProjectTab } from "@/lib/i18n/labels";

export async function ProjectStubPage({ params, tab }: { params: ProjectParams; tab: ProjectTab }) {
  const project = await loadProject(params);
  return <StubPage title={project.name} subtitle={`${PROJECT_TAB_LABELS[tab]} · ${project.key}`} />;
}
