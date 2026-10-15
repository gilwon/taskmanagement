// 작업 댓글·작업 활동 서버 조회. 범위는 RLS가 자르고 작성자·반응·대상은 한 번의 임베드 조회로 읽는다
import "server-only";
import { REACTION_EMOJIS } from "@/lib/i18n/labels";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };

export type Reaction = { emoji: (typeof REACTION_EMOJIS)[number]; userIds: string[] };

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  authorId: string | null;
  // 프로필이 지워졌거나 볼 수 없으면 null
  authorName: string | null;
  // REACTION_EMOJIS 순서, 누른 사람이 있는 것만
  reactions: Reaction[];
};

// shortcut: 작업 하나의 댓글은 최근 200개까지 읽는다. 더 많아지면 이전 댓글 더 보기를 붙인다
const COMMENT_LIMIT = 200;

export function groupReactions(rows: { user_id: string; emoji: string }[]): Reaction[] {
  return REACTION_EMOJIS.flatMap((emoji) => {
    const userIds = rows.filter((r) => r.emoji === emoji).map((r) => r.user_id);
    return userIds.length ? [{ emoji, userIds }] : [];
  });
}

// 삭제된 댓글은 뺀다. comments_select 정책은 작성자·편집 권한자에게 지운 행도 보여 준다
export async function selectTaskComments(
  supabase: Client,
  taskId: string,
): Promise<{ data: CommentItem[]; error: null } | { data: null; error: DbError }> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, body, created_at, updated_at, author_id,
      author:profiles!comments_author_id_fkey(name, email),
      comment_reactions(user_id, emoji)`,
    )
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(COMMENT_LIMIT);
  if (error) return { data: null, error };
  return {
    data: data
      .map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        updated_at: c.updated_at,
        authorId: c.author_id,
        authorName: c.author?.name || c.author?.email || null,
        reactions: groupReactions(c.comment_reactions),
      }))
      .reverse(),
    error: null,
  };
}

export type TaskActivity = {
  id: string;
  verb: string;
  extra: unknown;
  created_at: string;
  actorId: string | null;
  actorName: string | null;
};

// shortcut: 작업 하나의 활동은 최근 100건까지 읽는다. 더 필요하면 커서 조회(lib/activity/queries)로 바꾼다
const TASK_ACTIVITY_LIMIT = 100;

export async function selectTaskActivities(
  supabase: Client,
  taskId: string,
): Promise<{ data: TaskActivity[]; error: null } | { data: null; error: DbError }> {
  const { data, error } = await supabase
    .from("activities")
    .select("id, verb, extra, created_at, actor_id, actor:profiles!activities_actor_id_fkey(name, email)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TASK_ACTIVITY_LIMIT);
  if (error) return { data: null, error };
  return {
    data: data.map((a) => ({
      id: a.id,
      verb: a.verb,
      extra: a.extra,
      created_at: a.created_at,
      actorId: a.actor_id,
      actorName: a.actor?.name || a.actor?.email || null,
    })),
    error: null,
  };
}
