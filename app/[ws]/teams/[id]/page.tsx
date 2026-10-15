// 팀 상세. 팀 id로 이 워크스페이스의 팀을 찾고(없으면 404) 구성원·프로젝트·열린 작업을 보인다
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { TeamDetail } from "@/components/org/team-detail";
import { getTeam, getWorkspace, requireUserId } from "@/lib/data/workspace";
import { canOpenOrg, getOpenTaskCount, getOrgMembers, getTeamProjects, getTeams } from "@/lib/org/queries";
import { isAdminRole } from "@/lib/org/rules";

type Params = Promise<{ ws: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, id } = await params;
  // 403 응답의 제목에 팀 이름이 실리지 않게 역할부터 본다
  if (!(await canOpenOrg(ws))) return {};
  const team = await getTeam(ws, id);
  return team ? { title: team.name } : {};
}

export default async function TeamPage({ params }: { params: Params }) {
  const { ws, id } = await params;
  const [userId, workspace, found] = await Promise.all([requireUserId(), getWorkspace(ws), getTeam(ws, id)]);
  // 워크스페이스 404 → 역할 403 → 팀 404 순서로 본다. 게스트에게 팀 id의 존재를 드러내지 않는다
  if (!workspace) notFound();
  if (!(await canOpenOrg(ws))) forbidden();
  if (!found) notFound();
  const [teams, members, allProjects] = await Promise.all([
    getTeams(workspace.id),
    getOrgMembers(workspace.id),
    getTeamProjects(workspace.id),
  ]);
  const team = teams.find((t) => t.id === id);
  if (!team) notFound();
  const projects = allProjects.filter((p) => p.teamId === id);
  // 열린 작업은 팀 구성원(비활성 제외)이 담당한 것만 센다
  const people = members.filter((m) => m.teamId === id && m.status !== "deactivated").map((m) => m.id);
  const openTasks = await getOpenTaskCount(workspace.id, people);
  return (
    <TeamDetail
      workspace={workspace}
      team={team}
      members={members}
      projects={projects}
      openTasks={openTasks}
      admin={isAdminRole(members.find((m) => m.id === userId)?.role)}
    />
  );
}
