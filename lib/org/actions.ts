"use server";
// 조직 쓰기 Server Action(구성원·초대·팀·워크스페이스 설정·계정). 클레임을 확인하고 입력을 다시 검증한 뒤
// RLS가 걸린 서버 클라이언트로 쓴다. 권한의 최종 판정은 DB(RLS·트리거·RPC)가 하고 결과는 한국어 문구로 돌려준다
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { MSG, authErrorMessage } from "@/lib/auth/errors";
import { MIN_PASSWORD_LENGTH, SLUG_RE } from "@/lib/auth/rules";
import { isDemoUser } from "@/lib/demo/config";
import { PROJECT_COLORS } from "@/lib/i18n/labels";
import { orgErrorMessage } from "@/lib/org/errors";
import { INVITE_ROLES, MAX_INVITES, NOTIF_KEYS, TEAM_ICONS, parseInviteEmails, type Role } from "@/lib/org/rules";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "입력값을 다시 확인해 주세요.";
const ROLES: readonly Role[] = ["owner", "admin", "member", "guest"];

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const err = <T>(error: string): ActionResult<T> => ({ ok: false, error });

function dbErr<T>(what: string, error: { code?: string; message: string }, duplicate?: string): ActionResult<T> {
  console.error(`[${what}]`, error.code, error.message);
  return err(orgErrorMessage(error, duplicate));
}

const isId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max + 1) : "");

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  return uid ? { supabase, uid, demo: isDemoUser(data.claims) } : null;
}

// ─────────────────────────────────────────────
// 초대
// ─────────────────────────────────────────────

export type InviteOutcome = { email: string; ok: boolean; message?: string };

// 이메일마다 따로 넣어 실패(already_member·중복)를 건별로 알린다. 메일은 보내지 않는다
export async function inviteMembers(
  workspaceId: string,
  rawEmails: string,
  role: string,
): Promise<ActionResult<InviteOutcome[]>> {
  if (!isId(workspaceId) || typeof rawEmails !== "string" || !(INVITE_ROLES as readonly string[]).includes(role)) {
    return err(INVALID);
  }
  const { emails, invalid } = parseInviteEmails(rawEmails);
  if (invalid.length) return err(`이메일 형식이 올바르지 않습니다. ${invalid.slice(0, 3).join(", ")}`);
  if (emails.length === 0) return err(MSG.emailRequired);
  if (emails.length > MAX_INVITES) return err(`한 번에 ${MAX_INVITES}명까지 초대할 수 있습니다.`);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  // 데모 사본에는 초대를 넣을 수 없다(DB 정책도 거부한다)
  if (s.demo) return err(MSG.demoRestricted);

  const results: InviteOutcome[] = [];
  for (const email of emails) {
    const { error } = await s.supabase
      .from("workspace_invites")
      .insert({ workspace_id: workspaceId, email, role: role as Role, invited_by: s.uid });
    if (error) console.error("[초대]", error.code, error.message);
    results.push(
      error ? { email, ok: false, message: orgErrorMessage(error, "이미 초대 대기 중인 이메일입니다.") } : { email, ok: true },
    );
  }
  if (results.some((r) => r.ok)) refresh();
  return ok(results);
}

// 대기 중 초대 취소. 행은 남기고 revoked로 바꾼다
export async function revokeInvite(inviteId: string): Promise<ActionResult<null>> {
  if (!isId(inviteId)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending")
    .select("id");
  if (error) return dbErr("초대 취소", error);
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "not_found" }));
  refresh();
  return ok(null);
}

// 받은 초대 수락. 들어간 워크스페이스 slug를 돌려준다
export async function acceptInvite(inviteId: string): Promise<ActionResult<{ slug: string }>> {
  if (!isId(inviteId)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  // 데모 계정은 데모 워크스페이스 밖으로 나가지 않는다
  if (s.demo) return err(MSG.demoRestricted);
  const { data, error } = await s.supabase.rpc("accept_invite", { p_invite: inviteId });
  if (error) return dbErr("초대 수락", error);
  if (data.status !== "active") return err("이 워크스페이스에서 비활성화된 계정이라 들어갈 수 없습니다. 관리자에게 문의해 주세요.");
  const ws = await s.supabase.from("workspaces").select("slug").eq("id", data.workspace_id).maybeSingle();
  if (ws.error) return dbErr("워크스페이스", ws.error);
  if (!ws.data) return err(orgErrorMessage({ code: "P0001", message: "not_found" }));
  return ok({ slug: ws.data.slug });
}

export async function declineInvite(inviteId: string): Promise<ActionResult<null>> {
  if (!isId(inviteId)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { error } = await s.supabase.rpc("decline_invite", { p_invite: inviteId });
  if (error) return dbErr("초대 거절", error);
  refresh();
  return ok(null);
}

// ─────────────────────────────────────────────
// 구성원
// ─────────────────────────────────────────────

export async function setMemberRole(workspaceId: string, userId: string, role: string): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || !isId(userId) || !(ROLES as readonly string[]).includes(role)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { error } = await s.supabase.rpc("set_member_role", {
    p_workspace: workspaceId,
    p_user: userId,
    p_role: role as Role,
  });
  if (error) return dbErr("역할 변경", error);
  refresh();
  return ok(null);
}

// 비활성화·재활성화. 초대됨 구성원은 초대 수락으로만 active가 된다(DB 트리거)
export async function setMemberStatus(
  workspaceId: string,
  userId: string,
  status: "active" | "deactivated",
): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || !isId(userId) || (status !== "active" && status !== "deactivated")) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("workspace_members")
    .update({ status })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return dbErr("구성원 상태", error);
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  refresh();
  return ok(null);
}

// 팀 배정. teamId null이면 팀에서 뺀다
export async function setMemberTeam(
  workspaceId: string,
  userId: string,
  teamId: string | null,
): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || !isId(userId) || (teamId !== null && !isId(teamId))) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("workspace_members")
    .update({ team_id: teamId })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return dbErr("팀 배정", error);
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  refresh();
  return ok(null);
}

// ─────────────────────────────────────────────
// 팀
// ─────────────────────────────────────────────

export type TeamInput = { name: string; description: string; icon: string; color: string };

function checkTeam(input: TeamInput): TeamInput | null {
  const name = text(input?.name, 80);
  const description = text(input?.description, 500);
  if (!name || name.length > 80 || description.length > 500) return null;
  if (!(TEAM_ICONS as readonly string[]).includes(input?.icon) || !Object.hasOwn(PROJECT_COLORS, input?.color)) return null;
  return { name, description, icon: input.icon, color: input.color };
}

export async function createTeam(workspaceId: string, input: TeamInput): Promise<ActionResult<{ id: string }>> {
  const team = checkTeam(input);
  if (!isId(workspaceId) || !team) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("teams")
    .insert({ workspace_id: workspaceId, ...team, description: team.description || null })
    .select("id")
    .single();
  if (error) return dbErr("팀 만들기", error);
  refresh();
  return ok({ id: data.id });
}

export async function updateTeam(teamId: string, input: TeamInput): Promise<ActionResult<null>> {
  const team = checkTeam(input);
  if (!isId(teamId) || !team) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("teams")
    .update({ ...team, description: team.description || null })
    .eq("id", teamId)
    .select("id");
  if (error) return dbErr("팀 편집", error);
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  refresh();
  return ok(null);
}

// 팀을 지우면 구성원·프로젝트의 team_id는 FK on delete set null로 비워진다
export async function deleteTeam(teamId: string): Promise<ActionResult<null>> {
  if (!isId(teamId)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) return dbErr("팀 삭제", error);
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  refresh();
  return ok(null);
}

// ─────────────────────────────────────────────
// 워크스페이스
// ─────────────────────────────────────────────

// 이름·URL 변경. URL이 바뀌면 호출부가 새 주소로 옮긴다
export async function updateWorkspace(
  workspaceId: string,
  input: { name: string; slug: string },
): Promise<ActionResult<{ slug: string }>> {
  const name = text(input?.name, 80);
  const slug = text(input?.slug, 39).toLowerCase();
  if (!isId(workspaceId)) return err(INVALID);
  if (!name) return err(MSG.workspaceNameRequired);
  if (name.length > 80) return err(MSG.workspaceNameTooLong);
  if (!SLUG_RE.test(slug)) return err(MSG.slugInvalid);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { data, error } = await s.supabase
    .from("workspaces")
    .update({ name, slug })
    .eq("id", workspaceId)
    .select("slug");
  if (error) return dbErr("워크스페이스 설정", error, orgErrorMessage({ code: "P0001", message: "slug_taken" }));
  if (data.length === 0) return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  refresh();
  return ok({ slug: data[0].slug });
}

// PostgREST max_rows와 같은 페이지 크기
const FILE_PAGE = 1000;

// 워크스페이스 삭제. Storage 객체가 고아로 남지 않게 정해진 순서로 지운다(org 마이그레이션 delete_workspace)
// 1. owner·확인 입력 확인 2. 남은 프로젝트 소프트 삭제 3. 파일 객체 삭제 4. delete_workspace
// 1을 먼저 하는 이유. 2는 admin도 할 수 있어 owner가 아닌 사람이 부르면 프로젝트만 휴지통으로 가고 4에서 거부된다
export async function deleteWorkspace(workspaceId: string, confirm: string): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || typeof confirm !== "string") return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { supabase } = s;

  const [ws, me] = await Promise.all([
    supabase.from("workspaces").select("slug").eq("id", workspaceId).maybeSingle(),
    supabase.from("workspace_members").select("role, status").eq("workspace_id", workspaceId).eq("user_id", s.uid).maybeSingle(),
  ]);
  if (ws.error) return dbErr("워크스페이스", ws.error);
  if (me.error) return dbErr("구성원 정보", me.error);
  if (!ws.data) return err(orgErrorMessage({ code: "P0001", message: "not_found" }));
  if (me.data?.role !== "owner" || me.data.status !== "active") return err(orgErrorMessage({ code: "P0001", message: "forbidden" }));
  if (confirm.trim() !== ws.data.slug) return err(orgErrorMessage({ code: "P0001", message: "confirm_mismatch" }));

  const projects = await supabase.from("projects").select("id").eq("workspace_id", workspaceId).is("deleted_at", null);
  if (projects.error) return dbErr("프로젝트 목록", projects.error);
  for (const p of projects.data) {
    const { error } = await supabase.rpc("soft_delete_project", { p_project: p.id });
    // conflict는 그사이 다른 사람이 지운 경우라 계속 간다
    if (error && error.message !== "conflict") return dbErr("프로젝트 삭제", error);
  }

  // PostgREST가 한 번에 1000행까지만 주므로 id 순으로 페이지를 넘기며 전부 지운다.
  // 객체를 지워도 files 행은 delete_workspace까지 남아 있어 순서가 흔들리지 않는다
  for (let from = 0; ; from += FILE_PAGE) {
    const files = await supabase
      .from("files")
      .select("storage_path")
      .eq("workspace_id", workspaceId)
      .order("id")
      .range(from, from + FILE_PAGE - 1);
    if (files.error) return dbErr("파일 목록", files.error);
    const paths = files.data.map((f) => f.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from("files").remove(paths.slice(i, i + 100));
      if (error) {
        console.error("[파일 객체 삭제]", error.message);
        return err(orgErrorMessage({ code: "P0001", message: "files_remain" }));
      }
    }
    if (paths.length < FILE_PAGE) break;
  }

  const { error } = await supabase.rpc("delete_workspace", { p_workspace: workspaceId, p_confirm: ws.data.slug });
  if (error) return dbErr("워크스페이스 삭제", error);
  redirect("/");
}

// ─────────────────────────────────────────────
// 개인 설정
// ─────────────────────────────────────────────

// 이름(profiles.name)과 이 워크스페이스의 직함(workspace_members.title)
export async function updateProfile(
  workspaceId: string,
  input: { name: string; title: string },
): Promise<ActionResult<null>> {
  const name = text(input?.name, 80);
  const title = text(input?.title, 80);
  if (!isId(workspaceId)) return err(INVALID);
  if (!name) return err(MSG.nameRequired);
  if (name.length > 80 || title.length > 80) return err(MSG.nameTooLong);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const [p, m] = await Promise.all([
    s.supabase.from("profiles").update({ name }).eq("id", s.uid),
    s.supabase
      .from("workspace_members")
      .update({ title: title || null })
      .eq("workspace_id", workspaceId)
      .eq("user_id", s.uid),
  ]);
  if (p.error) return dbErr("프로필", p.error);
  if (m.error) return dbErr("직함", m.error);
  refresh();
  return ok(null);
}

// 이 워크스페이스에서 쓰는 내 시간대. 구성원 프로필에 보인다
export async function updateTimezone(workspaceId: string, tz: string): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || typeof tz !== "string" || !Intl.supportedValuesOf("timeZone").includes(tz)) return err(INVALID);
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { error } = await s.supabase
    .from("workspace_members")
    .update({ tz })
    .eq("workspace_id", workspaceId)
    .eq("user_id", s.uid);
  if (error) return dbErr("시간대", error);
  refresh();
  return ok(null);
}

// 앱 내 알림 종류별 켜기·끄기. private.notify가 false인 종류를 보내지 않는다
export async function saveNotifPrefs(workspaceId: string, prefs: Record<string, boolean>): Promise<ActionResult<null>> {
  if (!isId(workspaceId) || !prefs || typeof prefs !== "object") return err(INVALID);
  const clean: Record<string, boolean> = {};
  for (const k of NOTIF_KEYS) {
    if (typeof prefs[k] !== "boolean") return err(INVALID);
    clean[k] = prefs[k];
  }
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  const { error } = await s.supabase
    .from("user_prefs")
    .upsert({ user_id: s.uid, workspace_id: workspaceId, notif_prefs: clean }, { onConflict: "user_id,workspace_id" });
  if (error) return dbErr("알림 설정", error);
  return ok(null);
}

export type PasswordState = { ok: true } | { needNonce: true } | { error: { field?: string; message: string } } | null;

// 비밀번호 변경. secure_password_change가 켜져 있어 24시간 안에 로그인한 세션이 아니면 GoTrue가
// reauthentication_needed로 거부한다. 그때 reauthenticate()로 메일 인증 코드를 보내고 코드(nonce)를 받아 다시 보낸다
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const nonce = String(formData.get("nonce") ?? "").trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: { field: "password", message: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` } };
  }
  if (password !== confirm) return { error: { field: "confirm", message: MSG.passwordMismatch } };
  const s = await session();
  if (!s) return { error: { message: MSG.sessionExpired } };
  // 데모 사용자는 비밀번호를 설정해 실제 계정으로 바꾸지 못한다. 재인증 요청도 여기서 함께 막힌다
  if (s.demo) return { error: { message: MSG.demoRestricted } };

  const { error } = await s.supabase.auth.updateUser(nonce ? { password, nonce } : { password });
  if (!error) return { ok: true };
  if (error.code === "reauthentication_needed") {
    const re = await s.supabase.auth.reauthenticate();
    if (re.error) return { error: authErrorMessage(re.error.code) };
    return { needNonce: true };
  }
  if (error.code === "reauthentication_not_valid" || error.code === "reauth_nonce_missing") {
    return { error: { field: "nonce", message: "인증 코드가 올바르지 않거나 만료되었습니다. 메일의 최신 코드를 입력해 주세요." } };
  }
  return { error: authErrorMessage(error.code) };
}

// 이 기기를 뺀 다른 모든 로그인 세션을 끝낸다
export async function signOutOthers(): Promise<ActionResult<null>> {
  const s = await session();
  if (!s) return err(MSG.sessionExpired);
  // 데모 사용자에게는 쓸 일이 없는 기능이라 막아 둔다
  if (s.demo) return err(MSG.demoRestricted);
  const { error } = await s.supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("[다른 기기 로그아웃]", error.code, error.message);
    return err(authErrorMessage(error.code).message);
  }
  return ok(null);
}
