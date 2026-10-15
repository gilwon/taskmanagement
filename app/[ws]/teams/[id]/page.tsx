// 팀 상세 골격. 팀 id로 이 워크스페이스의 팀을 찾고 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { getTeam } from "@/lib/data/workspace";

type Params = Promise<{ ws: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, id } = await params;
  const team = await getTeam(ws, id);
  return team ? { title: team.name } : {};
}

export default async function TeamPage({ params }: { params: Params }) {
  const { ws, id } = await params;
  const team = await getTeam(ws, id);
  if (!team) notFound();
  return <StubPage title={team.name} subtitle={team.description ?? undefined} />;
}
