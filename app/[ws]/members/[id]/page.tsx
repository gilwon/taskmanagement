// 구성원 프로필 골격. 사용자 id로 이 워크스페이스의 구성원을 찾고 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { getMember } from "@/lib/data/workspace";
import { ROLE_LABELS } from "@/lib/i18n/labels";

type Params = Promise<{ ws: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, id } = await params;
  const member = await getMember(ws, id);
  return member ? { title: member.profiles?.name || "구성원" } : {};
}

export default async function MemberPage({ params }: { params: Params }) {
  const { ws, id } = await params;
  const member = await getMember(ws, id);
  if (!member) notFound();
  const subtitle = [member.title, ROLE_LABELS[member.role]].filter(Boolean).join(" · ");
  return <StubPage title={member.profiles?.name || "이름 없음"} subtitle={subtitle} />;
}
