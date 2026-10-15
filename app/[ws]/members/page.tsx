// 구성원 화면. 워크스페이스 구성원과 역할·상태, 대기 중인 초대를 관리한다. ?invite=1이면 초대 대화상자를 연 채 연다
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { MembersView } from "@/components/org/members-view";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { canOpenOrg, getMemberStats, getOrgMembers, getPendingInvites, getTeams } from "@/lib/org/queries";

export const metadata: Metadata = { title: NAV_LABELS.members };

type Props = { params: Promise<{ ws: string }>; searchParams: Promise<{ invite?: string }> };

export default async function MembersPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  if (!(await canOpenOrg(ws))) forbidden();
  const [members, stats, teams, invites] = await Promise.all([
    getOrgMembers(workspace.id),
    getMemberStats(workspace.id),
    getTeams(workspace.id),
    getPendingInvites(workspace.id),
  ]);
  return (
    <MembersView
      workspace={workspace}
      meId={userId}
      members={members}
      stats={Object.fromEntries(stats)}
      teams={teams}
      invites={invites}
      openInvite={query.invite === "1"}
      now={new Date().toISOString()}
    />
  );
}
