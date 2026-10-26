// 조직 화면(구성원·팀·설정·초대) 서버 조회. 범위는 RLS가 자르고, 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다
import "server-only";
import { cache } from "react";
import { getMember, requireUserId } from "@/lib/data/workspace";
import type { Enums } from "@/lib/database.types";
import { getT } from "@/lib/i18n/server";
import { orgErrorMessage } from "@/lib/org/errors";
import {
  DEFAULT_USER_PREFS,
  NOTIF_KEYS,
  canOpenOrgScreens,
  parseStartTab,
  parseTaskOpen,
  type UserPrefsView,
} from "@/lib/org/rules";
import { createClient } from "@/lib/supabase/server";

// 내 역할로 조직 화면(구성원·팀·역할과 권한)을 열 수 있는지. 페이지는 false면 forbidden()을 부른다
export async function canOpenOrg(ws: string) {
  const me = await getMember(ws, await requireUserId());
  return canOpenOrgScreens(me?.role);
}

function fail(what: string, error: { code?: string; message: string }): never {
  console.error(`[${what}]`, error.code, error.message);
  throw new Error(`${what}을(를) 불러오지 못했습니다. ${orgErrorMessage(error)}`);
}

export type OrgMember = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: Enums<"ws_role">;
  status: Enums<"member_status">;
  title: string | null;
  teamId: string | null;
  tz: string;
  lastActiveAt: string | null;
  joinedAt: string;
};

export type OrgTeam = { id: string; name: string; icon: string; color: string; description: string | null };

export type PendingInvite = {
  id: string;
  email: string;
  role: Enums<"ws_role">;
  createdAt: string;
  invitedBy: string | null;
};

export type TeamProject = {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  status: Enums<"project_status">;
  teamId: string | null;
};

// 상태와 무관하게 모든 구성원 행(초대됨·비활성 포함). 이름순
export const getOrgMembers = cache(async (workspaceId: string): Promise<OrgMember[]> => {
  const [supabase, t] = await Promise.all([createClient(), getT()]);
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, status, title, color, team_id, tz, last_active_at, created_at, profiles(name, email, color)")
    .eq("workspace_id", workspaceId);
  if (error) fail("구성원 목록", error);
  return data
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.name || m.profiles?.email || t("common.namelessMember"),
      email: m.profiles?.email ?? "",
      color: m.color ?? m.profiles?.color ?? "indigo",
      role: m.role,
      status: m.status,
      title: m.title,
      teamId: m.team_id,
      tz: m.tz,
      lastActiveAt: m.last_active_at,
      joinedAt: m.created_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
});

export const getTeams = cache(async (workspaceId: string): Promise<OrgTeam[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, icon, color, description")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) fail("팀 목록", error);
  return data;
});

// 관리자만 행이 보인다(workspace_invites_select). 그 밖의 사람에게는 빈 목록이다
export async function getPendingInvites(workspaceId: string): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, created_at, inviter:profiles!workspace_invites_invited_by_fkey(name, email)")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) fail("초대 목록", error);
  return data.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    createdAt: i.created_at,
    invitedBy: i.inviter?.name || i.inviter?.email || null,
  }));
}

// 팀 화면용. 삭제되지 않은 프로젝트(보관 포함 안 함)
export async function getTeamProjects(workspaceId: string): Promise<TeamProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, key, name, icon, color, status, team_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("name");
  if (error) fail("프로젝트 목록", error);
  return data.map(({ team_id, ...p }) => ({ ...p, teamId: team_id }));
}

export type NotifPrefs = Record<(typeof NOTIF_KEYS)[number], boolean>;

// 행이나 키가 없으면 켜짐(private.notify와 같은 기본값)
export async function getNotifPrefs(workspaceId: string, userId: string): Promise<NotifPrefs> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_prefs")
    .select("notif_prefs")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("알림 설정", error);
  const raw = (data?.notif_prefs ?? {}) as Record<string, unknown>;
  return Object.fromEntries(NOTIF_KEYS.map((k) => [k, raw[k] !== false])) as NotifPrefs;
}

// 환경 설정. 행이 없으면 기본값이다. 레이아웃과 설정 화면이 한 요청에서 함께 읽으므로 cache로 한 번만 묻는다
export const getUserPrefs = cache(async (workspaceId: string, userId: string): Promise<UserPrefsView> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_prefs")
    .select("default_tab, task_open, show_done_board, confirm_del")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("환경 설정", error);
  if (!data) return { ...DEFAULT_USER_PREFS };
  return {
    startTab: parseStartTab(data.default_tab),
    taskOpen: parseTaskOpen(data.task_open),
    showDoneBoard: data.show_done_board,
    confirmDel: data.confirm_del,
  };
});

export type MyInvite = { id: string; workspaceName: string; role: Enums<"ws_role">; createdAt: string };

// 로그인 사용자 이메일로 온 pending 초대(my_invites RPC)
export async function getMyInvites(): Promise<MyInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invites");
  if (error) fail("받은 초대", error);
  return data.map((i) => ({ id: i.invite_id, workspaceName: i.workspace_name, role: i.role, createdAt: i.created_at }));
}

// 구성원 표의 참여 프로젝트·열린 작업 수(workspace_member_stats). 담당 작업이 없는 사람은 맵에 없다
export async function getMemberStats(workspaceId: string): Promise<Map<string, { projects: number; tasks: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("workspace_member_stats", { p_workspace: workspaceId });
  if (error) fail("구성원 집계", error);
  return new Map(data.map((r) => [r.user_id, { projects: r.project_count, tasks: r.task_count }]));
}

// 구성원 프로필이 그리는 담당 작업. 화면에 쓰는 열만 읽고 편집 권한은 묻지 않는다
const PROFILE_TASK_SELECT =
  "id, key, title, status, due_date, project:projects!tasks_project_id_workspace_id_fkey!inner(id, name, deleted_at, archived_at)";

export type MemberTask = {
  id: string;
  key: string;
  title: string;
  status: Enums<"task_status">;
  due_date: string | null;
  project: { id: string; name: string };
};

// 삭제·보관된 작업과 삭제·보관된 프로젝트의 작업은 뺀다(작업 목록과 같은 기준)
// shortcut: PostgREST max_rows(1000)에서 잘린다, 한 사람 담당이 1000건을 넘으면 페이지로 나눈다
export async function getMemberTasks(workspaceId: string, userId: string): Promise<MemberTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(PROFILE_TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .is("project.deleted_at", null)
    .is("project.archived_at", null)
    .order("sort_order");
  if (error) fail("담당 작업", error);
  return data;
}

// 팀 구성원이 담당한 열린 작업 수. 행을 읽지 않고 개수만 센다
export async function getOpenTaskCount(workspaceId: string, assigneeIds: string[]): Promise<number> {
  if (assigneeIds.length === 0) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id, project:projects!tasks_project_id_workspace_id_fkey!inner(id, deleted_at, archived_at)", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("assignee_id", assigneeIds)
    .neq("status", "done")
    .is("deleted_at", null)
    .is("archived_at", null)
    .is("project.deleted_at", null)
    .is("project.archived_at", null);
  if (error) fail("열린 작업 수", error);
  return count ?? 0;
}
