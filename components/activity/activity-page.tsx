// 활동 화면 서버 본문. 워크스페이스·프로젝트 활동 페이지가 함께 쓴다. ?kind=·?by= 필터로 첫 쪽을 읽고 작업 store(드로어용)를 연다
import { ActivityFeed } from "@/components/activity/activity-feed";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { ACTIVITY_KINDS, type ActivityFilter, type ActivityKind, selectActivities } from "@/lib/activity/queries";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { getWorkspaceLabels, getWorkspaceMembers } from "@/lib/tasks/queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActivitySearch = Record<string, string | string[] | undefined>;

// 모르는 값은 필터 없음으로 본다
export function parseActivityFilter(query: ActivitySearch): ActivityFilter {
  const kind = typeof query.kind === "string" ? query.kind : undefined;
  const by = typeof query.by === "string" ? query.by : undefined;
  return {
    kind: kind && (ACTIVITY_KINDS as readonly string[]).includes(kind) ? (kind as ActivityKind) : undefined,
    actorId: by && UUID_RE.test(by) ? by : undefined,
  };
}

export async function ActivityPageBody({
  workspace,
  userId,
  projectId,
  query,
}: {
  workspace: { id: string; slug: string; name: string };
  userId: string;
  projectId: string | null;
  query: ActivitySearch;
}) {
  const filter = parseActivityFilter(query);
  const supabase = await createClient();
  const [page, members, labels] = await Promise.all([
    selectActivities(supabase, { workspaceId: workspace.id, projectId: projectId ?? undefined }, filter, null),
    getWorkspaceMembers(workspace.id),
    getWorkspaceLabels(workspace.id),
  ]);
  // 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  if (page.error) {
    console.error("[활동]", page.error.code, page.error.message);
    const t = await getT();
    throw new Error(t("activity.loadFailed", { error: taskErrorMessage(page.error, t) }));
  }
  return (
    <TaskStoreProvider
      initialItems={[]}
      workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
      members={members}
      labels={labels}
      meId={userId}
    >
      <ActivityFeed initial={page.data} projectId={projectId} filter={filter} nowIso={new Date().toISOString()} />
    </TaskStoreProvider>
  );
}
