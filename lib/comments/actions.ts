"use server";
// 댓글·반응 Server Action과 드로어용 댓글·활동 읽기. 입력을 다시 검증하고 범위는 RLS·RPC가 판정한다. 오류는 현재 로캘 문구로 돌려준다
import { mentionIds } from "@/lib/comments/mentions";
import { NAMELESS_MEMBER_LABEL, REACTION_EMOJIS } from "@/lib/i18n/labels";
import type { Messages } from "@/lib/i18n/messages/types";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";
import {
  type CommentItem,
  type TaskActivity,
  selectTaskActivities,
  selectTaskComments,
} from "@/lib/comments/queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// comments.body check 제약과 같은 길이
const BODY_MAX = 10_000;
const MENTION_MAX = 50;

const isId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

// 댓글에 맞춘 문구. 나머지는 작업 오류 문구를 그대로 쓴다
const COMMENT_MESSAGES: Record<string, `comments.errors.${keyof Messages["comments"]["errors"]}`> = {
  not_found: "comments.errors.notFound",
  forbidden: "comments.errors.forbidden",
  conflict: "comments.errors.conflict",
  invalid_input: "comments.errors.invalidInput",
};

function commentError(what: string, error: { code?: string; message?: string }, t: T) {
  console.error(`[${what}]`, error.code, error.message);
  if (error.code === "P0001" && error.message && Object.hasOwn(COMMENT_MESSAGES, error.message)) {
    return t(COMMENT_MESSAGES[error.message]);
  }
  return taskErrorMessage(error, t);
}

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return sub ? { supabase, sub } : null;
}

// 앞뒤 공백을 지운 본문. 비었거나 너무 길면 null
function cleanBody(body: unknown) {
  if (typeof body !== "string") return null;
  const t = body.trim();
  return t.length > 0 && t.length <= BODY_MAX ? t : null;
}

export type CommentThread = {
  comments: CommentItem[];
  // 댓글·반응을 남길 수 있는지(comment 이상, 프로젝트가 살아 있음). 화면 숨김용이고 실제 판정은 RLS·RPC가 한다
  canComment: boolean;
  // 남의 댓글을 지울 수 있는지(full)
  canManage: boolean;
  // 이 작업의 활동 전체 개수. 드로어 활동 탭 이름에 쓴다
  activityCount: number;
};

type Session = NonNullable<Awaited<ReturnType<typeof session>>>;

// 작업의 프로젝트·워크스페이스. 클라이언트가 보낸 값은 믿지 않고 RLS가 보이는 작업 행에서 읽는다
async function taskScope(s: Session, taskId: string) {
  return s.supabase.from("tasks").select("project_id, workspace_id").eq("id", taskId).maybeSingle();
}

function countActivities(s: Session, taskId: string) {
  return s.supabase.from("activities").select("id", { count: "exact", head: true }).eq("task_id", taskId);
}

export async function loadComments(taskId: string): Promise<ActionResult<CommentThread>> {
  const t = await getT();
  if (!isId(taskId)) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const task = await taskScope(s, taskId);
  if (task.error) return { ok: false, error: commentError("댓글 읽기", task.error, t) };
  if (!task.data) return { ok: false, error: taskErrorMessage({ code: "PGRST116" }, t) };
  const projectId = task.data.project_id;
  const [comments, canComment, canManage, activities] = await Promise.all([
    selectTaskComments(s.supabase, taskId),
    s.supabase.rpc("can_comment_project_rows", { p: projectId }),
    s.supabase.rpc("can_manage_project", { p: projectId }),
    countActivities(s, taskId),
  ]);
  if (comments.error) return { ok: false, error: commentError("댓글 읽기", comments.error, t) };
  if (canComment.error) return { ok: false, error: commentError("댓글 권한", canComment.error, t) };
  if (canManage.error) return { ok: false, error: commentError("댓글 권한", canManage.error, t) };
  if (activities.error) return { ok: false, error: commentError("활동 개수", activities.error, t) };
  return {
    ok: true,
    data: {
      comments: comments.data,
      canComment: !!canComment.data,
      canManage: !!canManage.data,
      activityCount: activities.count ?? 0,
    },
  };
}

// 최근 활동(상한 있음)과 전체 개수
export async function loadTaskActivities(
  taskId: string,
): Promise<ActionResult<{ rows: TaskActivity[]; total: number }>> {
  const t = await getT();
  if (!isId(taskId)) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const [r, count] = await Promise.all([selectTaskActivities(s.supabase, taskId), countActivities(s, taskId)]);
  if (r.error) return { ok: false, error: commentError("작업 활동 읽기", r.error, t) };
  if (count.error) return { ok: false, error: commentError("활동 개수", count.error, t) };
  return { ok: true, data: { rows: r.data, total: count.count ?? r.data.length } };
}

type SavedComment = { id: string; body: string; created_at: string; updated_at: string };

// 본문에 "@이름"(mentions.ts 경계 규칙)으로 실제 들어 있는 구성원만 남긴다. 이름은 워크스페이스 구성원 전체로 맞춰
// 짧은 이름이 긴 이름의 앞부분에 걸리지 않게 한다. 본문에 없는 id는 조용히 뺀다
async function verifiedMentions(s: Session, workspaceId: string, body: string, requested: string[]) {
  if (requested.length === 0) return { data: [] as string[], error: null };
  const { data, error } = await s.supabase
    .from("workspace_members")
    .select("user_id, profiles(name, email)")
    .eq("workspace_id", workspaceId);
  if (error) return { data: null, error };
  const members = data.map((m) => ({
    id: m.user_id,
    name: m.profiles?.name || m.profiles?.email || NAMELESS_MEMBER_LABEL,
  }));
  const found = new Set(mentionIds(body, members));
  return { data: [...new Set(requested)].filter((id) => found.has(id)), error: null };
}

// add_comment가 작성자를 호출자로 고정하고 멘션 대상 중 그 프로젝트를 볼 수 있는 사람에게만 알림을 보낸다
export async function addComment(taskId: string, body: string, mentions: string[]): Promise<ActionResult<SavedComment>> {
  const t = await getT();
  const text = cleanBody(body);
  if (!isId(taskId) || !text || !Array.isArray(mentions) || mentions.length > MENTION_MAX || !mentions.every(isId)) {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const task = await taskScope(s, taskId);
  if (task.error) return { ok: false, error: commentError("댓글 작성", task.error, t) };
  if (!task.data) return { ok: false, error: taskErrorMessage({ code: "PGRST116" }, t) };
  const verified = await verifiedMentions(s, task.data.workspace_id, text, mentions);
  if (verified.error) return { ok: false, error: commentError("멘션 확인", verified.error, t) };
  const { data, error } = await s.supabase.rpc("add_comment", {
    p_task: taskId,
    p_body: text,
    p_mentions: verified.data,
  });
  if (error) return { ok: false, error: commentError("댓글 작성", error, t) };
  return { ok: true, data: { id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at } };
}

// 본문만 바꾼다. 댓글 권한이 남은 작성자 본인만 RLS를 통과하고, 막히면 0행이 돌아온다.
// 수정은 멘션 알림을 다시 보내지 않는다(알림은 add_comment에서만 만든다)
export async function editComment(commentId: string, body: string): Promise<ActionResult<SavedComment>> {
  const t = await getT();
  const text = cleanBody(body);
  if (!isId(commentId) || !text) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const { data, error } = await s.supabase
    .from("comments")
    .update({ body: text })
    .eq("id", commentId)
    .is("deleted_at", null)
    .select("id, body, created_at, updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: commentError("댓글 수정", error, t) };
  if (!data) return { ok: false, error: t("comments.errors.forbidden") };
  return { ok: true, data };
}

// 소프트 삭제. 돌려받은 토큰(updated_at 문자열)은 바꾸지 않고 restoreComment에 그대로 넘긴다
export async function deleteComment(commentId: string): Promise<ActionResult<{ token: string }>> {
  const t = await getT();
  if (!isId(commentId)) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const { data, error } = await s.supabase.rpc("soft_delete_comment", { p_comment: commentId });
  if (error) return { ok: false, error: commentError("댓글 삭제", error, t) };
  return { ok: true, data: { token: data } };
}

export async function restoreComment(commentId: string, token: string): Promise<ActionResult<SavedComment>> {
  const t = await getT();
  if (!isId(commentId) || typeof token !== "string" || token.length > 64) return { ok: false, error: t("errors.rpc.invalidInput") };
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const { data, error } = await s.supabase.rpc("restore_comment", { p_comment: commentId, p_token: token });
  if (error) return { ok: false, error: commentError("댓글 복원", error, t) };
  return { ok: true, data: { id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at } };
}

// 내 반응을 켜고 끈다. user_id는 guard 트리거가 호출자로 덮는다
export async function setReaction(commentId: string, emoji: string, on: boolean): Promise<ActionResult<boolean>> {
  const t = await getT();
  if (!isId(commentId) || !(REACTION_EMOJIS as readonly string[]).includes(emoji) || typeof on !== "boolean") {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  const s = await session();
  if (!s) return { ok: false, error: t("errors.msg.sessionExpired") };
  const { error } = on
    ? await s.supabase.from("comment_reactions").insert({ comment_id: commentId, user_id: s.sub, emoji })
    : await s.supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", s.sub)
        .eq("emoji", emoji);
  // 이미 누른 반응은 성공으로 본다
  if (error && error.code !== "23505") return { ok: false, error: commentError("반응 저장", error, t) };
  return { ok: true, data: on };
}
