// 프로젝트 파일 탭. key로 프로젝트를 찾고 없으면 404. 파일 목록·연결할 작업·편집·관리 권한을 서버에서 한 번 읽어 넘긴다
import { notFound } from "next/navigation";
import { FilesView } from "@/components/files/files-view";
import { ProjectHeader } from "@/components/tasks/project-header";
import { getProjectFilesPage } from "@/lib/files/queries";
import { loadProject, projectMetadata, type ProjectParams } from "@/lib/data/project";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";

export function generateMetadata({ params }: { params: ProjectParams }) {
  return projectMetadata(params, "files");
}

export default async function ProjectFilesPage({ params }: { params: ProjectParams }) {
  const { ws } = await params;
  const [userId, workspace, project] = await Promise.all([requireUserId(), getWorkspace(ws), loadProject(params)]);
  if (!workspace) notFound();
  const { files, tasks, canEdit, canManage } = await getProjectFilesPage(project.id);

  return (
    <>
      <ProjectHeader
        wsSlug={workspace.slug}
        workspaceId={workspace.id}
        userId={userId}
        project={project}
        active="files"
      />
      <FilesView
        projectId={project.id}
        canEdit={canEdit}
        canManage={canManage}
        meId={userId}
        nowIso={new Date().toISOString()}
        initialFiles={files}
        tasks={tasks}
      />
    </>
  );
}
