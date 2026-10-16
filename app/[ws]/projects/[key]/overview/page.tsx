// 프로젝트 개요 탭. 설명·진행률·상태별 작업 수·다가오는 작업·세부 정보·마일스톤·구성원 권한·최근 활동을 보인다
import { notFound } from "next/navigation";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectHeader } from "@/components/tasks/project-header";
import { selectActivities } from "@/lib/activity/queries";
import { loadProject, projectMetadata, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { getProjectDetail } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { getWorkspaceMembers } from "@/lib/tasks/queries";

const ACTIVITY_MAX = 8;

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "overview");
}

export default async function ProjectOverviewPage({ params }: { params: ProjectParams }) {
  const { ws } = await params;
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  const supabase = await createClient();
  const [detail, members, activities] = await Promise.all([
    getProjectDetail(project.id),
    getWorkspaceMembers(workspace.id),
    selectActivities(supabase, { workspaceId: workspace.id, projectId: project.id }, {}, null),
  ]);
  // 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  if (activities.error) {
    console.error("[프로젝트 활동]", activities.error.code, activities.error.message);
    const t = await getT();
    throw new Error(t("projects.errors.activityLoadFailed", { reason: taskErrorMessage(activities.error, t) }));
  }
  const me = members.find((m) => m.id === userId);

  return (
    <>
      <ProjectHeader wsSlug={workspace.slug} workspaceId={workspace.id} userId={userId} project={project} active="overview" />
      <ProjectOverview
        detail={detail}
        members={members}
        meId={userId}
        wsAdmin={me?.role === "owner" || me?.role === "admin"}
        workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
        activities={activities.data.items.slice(0, ACTIVITY_MAX)}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
