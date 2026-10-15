// /{ws}/settings로 들어오면 일반 설정으로 보낸다
import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  redirect(`/${ws}/settings/general`);
}
