// 워크스페이스 레이아웃. slug로 소속 워크스페이스를 찾고(없으면 404) 셸 데이터를 읽어 앱 셸을 그린다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getShellData, getWorkspace, requireUserId } from "@/lib/data/workspace";

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
  if (!workspace) notFound();
  const data = await getShellData(workspace, userId);
  // 워크스페이스가 바뀌면 셸의 클라이언트 상태(펼침·메뉴)를 새로 시작한다
  return (
    <AppShell key={workspace.id} data={data}>
      {children}
    </AppShell>
  );
}
