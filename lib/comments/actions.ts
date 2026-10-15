"use server";
// 댓글·반응 Server Action과 드로어용 댓글·활동 읽기. 입력을 다시 검증하고 범위는 RLS·RPC가 판정한다. 오류는 한국어 결과로 돌려준다
import { MSG } from "@/lib/auth/errors";
import { REACTION_EMOJIS } from "@/lib/i18n/labels";
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
const INVALID = "입력값을 다시 확인해 주세요.";
// comments.body check 제약과 같은 길이
const BODY_MAX = 10_000;
const MENTION_MAX = 50;

const isId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

// 댓글에 맞춘 문구. 나머지는 작업 오류 문구를 그대로 쓴다
const COMMENT_MESSAGES: Record<string, string> = {
  not_found: "댓글을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
  forbidden: "이 댓글에 대한 권한이 없습니다.",
  conflict: "삭제한 뒤 바뀐 댓글이라 되돌릴 수 없습니다.",
  invalid_input: "댓글 내용을 입력해 주세요.",
};

function commentError(what: string, error: { code?: string; message?: string }) {
  console.error(`[${what}]`, error.code, error.message);
  if (error.code === "P0001" && error.message && Object.hasOwn(COMMENT_MESSAGES, error.message)) {
    return COMMENT_MESSAGES[error.message];
  }
  return taskErrorMessage(error);
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
};

export async function loadComments(taskId: string, projectId: string): Promise<ActionResult<CommentThread>> {
  if (!isId(taskId) || !isId(projectId)) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const [comments, canComment, canManage] = await Promise.all([
    selectTaskComments(s.supabase, taskId),
    s.supabase.rpc("can_comment_project_rows", { p: projectId }),
    s.supabase.rpc("can_manage_project", { p: projectId }),
  ]);
  if (comments.error) return { ok: false, error: commentError("댓글 읽기", comments.error) };
  if (canComment.error) return { ok: false, error: commentError("댓글 권한", canComment.error) };
  if (canManage.error) return { ok: false, error: commentError("댓글 권한", canManage.error) };
  return { ok: true, data: { comments: comments.data, canComment: !!canComment.data, canManage: !!canManage.data } };
}

export async function loadTaskActivities(taskId: string): Promise<ActionResult<TaskActivity[]>> {
  if (!isId(taskId)) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const r = await selectTaskActivities(s.supabase, taskId);
  if (r.error) return { ok: false, error: commentError("작업 활동 읽기", r.error) };
  return { ok: true, data: r.data };
}

type SavedComment = { id: string; body: string; created_at: string; updated_at: string };

// add_comment가 작성자를 호출자로 고정하고 멘션 대상 중 그 프로젝트를 볼 수 있는 사람에게만 알림을 보낸다
export async function addComment(taskId: string, body: string, mentions: string[]): Promise<ActionResult<SavedComment>> {
  const text = cleanBody(body);
  if (!isId(taskId) || !text || !Array.isArray(mentions) || mentions.length > MENTION_MAX || !mentions.every(isId)) {
    return { ok: false, error: INVALID };
  }
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase.rpc("add_comment", { p_task: taskId, p_body: text, p_mentions: mentions });
  if (error) return { ok: false, error: commentError("댓글 작성", error) };
  return { ok: true, data: { id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at } };
}

// 본문만 바꾼다. 댓글 권한이 남은 작성자 본인만 RLS를 통과하고, 막히면 0행이 돌아온다.
// 수정은 멘션 알림을 다시 보내지 않는다(알림은 add_comment에서만 만든다)
export async function editComment(commentId: string, body: string): Promise<ActionResult<SavedComment>> {
  const text = cleanBody(body);
  if (!isId(commentId) || !text) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase
    .from("comments")
    .update({ body: text })
    .eq("id", commentId)
    .is("deleted_at", null)
    .select("id, body, created_at, updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: commentError("댓글 수정", error) };
  if (!data) return { ok: false, error: COMMENT_MESSAGES.forbidden };
  return { ok: true, data };
}

// 소프트 삭제. 돌려받은 토큰(updated_at 문자열)은 바꾸지 않고 restoreComment에 그대로 넘긴다
export async function deleteComment(commentId: string): Promise<ActionResult<{ token: string }>> {
  if (!isId(commentId)) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase.rpc("soft_delete_comment", { p_comment: commentId });
  if (error) return { ok: false, error: commentError("댓글 삭제", error) };
  return { ok: true, data: { token: data } };
}

export async function restoreComment(commentId: string, token: string): Promise<ActionResult<SavedComment>> {
  if (!isId(commentId) || typeof token !== "string" || token.length > 64) return { ok: false, error: INVALID };
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase.rpc("restore_comment", { p_comment: commentId, p_token: token });
  if (error) return { ok: false, error: commentError("댓글 복원", error) };
  return { ok: true, data: { id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at } };
}

// 내 반응을 켜고 끈다. user_id는 guard 트리거가 호출자로 덮는다
export async function setReaction(commentId: string, emoji: string, on: boolean): Promise<ActionResult<boolean>> {
  if (!isId(commentId) || !(REACTION_EMOJIS as readonly string[]).includes(emoji) || typeof on !== "boolean") {
    return { ok: false, error: INVALID };
  }
  const s = await session();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { error } = on
    ? await s.supabase.from("comment_reactions").insert({ comment_id: commentId, user_id: s.sub, emoji })
    : await s.supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", s.sub)
        .eq("emoji", emoji);
  // 이미 누른 반응은 성공으로 본다
  if (error && error.code !== "23505") return { ok: false, error: commentError("반응 저장", error) };
  return { ok: true, data: on };
}
