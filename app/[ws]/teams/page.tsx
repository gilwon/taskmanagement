// 팀 목록 화면. 팀 카드와 관리자용 팀 만들기. ?new=1이면 새 팀 대화상자를 연 채 연다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamsView } from "@/components/org/teams-view";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { getOrgMembers, getTeamProjects, getTeams } from "@/lib/org/queries";
import { isAdminRole } from "@/lib/org/rules";

export const metadata: Metadata = { title: NAV_LABELS.teams };

type Props = { params: Promise<{ ws: string }>; searchParams: Promise<{ new?: string }> };

export default async function TeamsPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [teams, members, projects] = await Promise.all([
    getTeams(workspace.id),
    getOrgMembers(workspace.id),
    getTeamProjects(workspace.id),
  ]);
  return (
    <TeamsView
      workspace={workspace}
      teams={teams}
      members={members}
      projects={projects}
      admin={isAdminRole(members.find((m) => m.id === userId)?.role)}
      openNew={query.new === "1"}
    />
  );
}
