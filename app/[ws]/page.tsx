// /{ws}로 들어오면 환경 설정의 시작 화면(기본 홈)으로 보낸다
import { redirect } from "next/navigation";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getUserPrefs } from "@/lib/org/queries";
import { startPath } from "@/lib/org/rules";

export default async function WorkspaceIndex({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  // 없는 워크스페이스는 레이아웃이 404로 처리한다
  const tab = workspace ? (await getUserPrefs(workspace.id, userId)).startTab : "home";
  redirect(startPath(ws, tab));
}
