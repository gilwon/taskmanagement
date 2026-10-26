// 워크스페이스 레이아웃. slug로 소속 워크스페이스를 찾고(없으면 404) 셸 데이터를 읽어 앱 셸을 그린다
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkspacePrefsProvider } from "@/components/org/workspace-prefs";
import { NewProjectLauncher } from "@/components/projects/new-project-launcher";
import { AppShell } from "@/components/shell/app-shell";
import { NewTaskLauncher } from "@/components/tasks/new-task";
import { isGoneSession } from "@/lib/auth/rules";
import { getShellData, getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getUserPrefs } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";

type Props = { children: React.ReactNode; params: Promise<{ ws: string }> };

// 하위 페이지 제목에 " · {워크스페이스}"를 붙인다(spec R4)
export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { ws } = await params;
  const workspace = await getWorkspace(ws);
  if (!workspace) return {};
  return { title: { template: `%s · ${workspace.name}`, default: workspace.name } };
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { ws } = await params;
  const userId = await requireUserId();
  const workspace = await getWorkspace(ws);
  // 비소속·없는 slug는 RLS가 같은 결과(null)를 준다. 존재 여부를 드러내지 않고 404로 처리한다
  if (!workspace) {
    // 지워진 계정의 JWT도 만료 전까지 getClaims를 통과해 여기로 온다. 404일 때만 Auth 서버에 확인해 정상 경로 비용을 늘리지 않는다
    const { error } = await (await createClient()).auth.getUser();
    if (isGoneSession(error?.code)) redirect("/auth/signout");
    notFound();
  }
  const [data, prefs] = await Promise.all([getShellData(workspace, userId), getUserPrefs(workspace.id, userId)]);
  // 워크스페이스가 바뀌면 셸의 클라이언트 상태(펼침·메뉴)를 새로 시작한다
  // 새 작업·새 프로젝트 모달은 셸 어디서나 열 수 있게 셸 바깥에 둔다
  return (
    <WorkspacePrefsProvider value={prefs}>
      <NewTaskLauncher key={workspace.id} workspace={{ id: workspace.id, slug: workspace.slug }} meId={userId}>
        <NewProjectLauncher workspace={workspace} meId={userId}>
          <AppShell key={workspace.id} data={data}>
            {children}
          </AppShell>
        </NewProjectLauncher>
      </NewTaskLauncher>
    </WorkspacePrefsProvider>
  );
}
