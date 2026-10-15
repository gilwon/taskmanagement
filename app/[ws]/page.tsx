// /{ws}로 들어오면 홈으로 보낸다
import { redirect } from "next/navigation";

export default async function WorkspaceIndex({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  redirect(`/${ws}/home`);
}
