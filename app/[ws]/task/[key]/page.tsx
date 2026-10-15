// 작업 전체 페이지. 키(WEB-112)로 워크스페이스 안의 작업을 찾고 없거나 볼 권한이 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskPageView } from "@/components/tasks/drawer/task-page-view";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { getTask, getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getTaskItemByKey, getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

type Params = Promise<{ ws: string; key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, key } = await params;
  const task = await getTask(ws, key);
  return task ? { title: `${task.key} ${task.title}` } : {};
}

export default async function TaskPage({ params }: { params: Params }) {
  const { ws, key } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const task = await getTaskItemByKey(workspace.id, decodeURIComponent(key));
  if (!task) notFound();
  const [members, labels] = await Promise.all([getWorkspaceMembers(workspace.id), getWorkspaceLabels(workspace.id)]);

  return (
    <TaskStoreProvider
      initialItems={[task]}
      workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
      members={members}
      labels={labels}
      meId={userId}
    >
      <TaskPageView taskId={task.id} taskKey={task.key} />
    </TaskStoreProvider>
  );
}
