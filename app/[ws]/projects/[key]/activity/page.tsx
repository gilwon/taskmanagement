// 프로젝트 활동 탭. key로 프로젝트를 찾고(없으면 404) 그 프로젝트의 변경 기록을 종류·사람으로 거르고 날짜별로 보인다
import { notFound } from "next/navigation";
import { ActivityPageBody, type ActivitySearch } from "@/components/activity/activity-page";
import { ProjectHeader } from "@/components/tasks/project-header";
import { loadProject, projectMetadata, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "activity");
}

type Props = { params: ProjectParams; searchParams: Promise<ActivitySearch> };

export default async function ProjectActivityPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  return (
    <>
      <ProjectHeader wsSlug={workspace.slug} workspaceId={workspace.id} userId={userId} project={project} active="activity" />
      <div className="pt-(--s-4)">
        <ActivityPageBody workspace={workspace} userId={userId} projectId={project.id} query={query} />
      </div>
    </>
  );
}
