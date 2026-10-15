"use client";
// 작업 댓글 탭. 목록(작성자·상대 시간·수정됨·반응)과 입력창. 본인 댓글 수정·삭제, 관리 권한자의 삭제, 실행 취소 토스트.
// 보기 권한만 있으면 입력창·반응 버튼을 숨긴다(실제 거부는 RLS·RPC). 댓글 수가 바뀌면 작업 store의 개수도 맞춘다
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentBody } from "@/components/comments/comment-body";
import { CommentComposer } from "@/components/comments/comment-composer";
import { Reactions } from "@/components/comments/reactions";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import {
  addComment,
  deleteComment,
  editComment,
  loadComments,
  restoreComment,
  setReaction,
  type CommentThread,
} from "@/lib/comments/actions";
import type { CommentItem } from "@/lib/comments/queries";
import { formatRelative } from "@/lib/format/date";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { REACTION_EMOJIS, UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import type { ActionResult, TaskItem } from "@/lib/tasks/types";

// 서버 액션 호출 자체가 실패(네트워크)해도 결과 형태로 받는다
async function call<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (e) {
    console.error("[댓글]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }) };
  }
}

function announce(text: string) {
  const live = document.getElementById("sr-live");
  if (live) live.textContent = text;
}

// 수정 여부. shortcut: updated_at은 소프트 삭제·복원에도 바뀌어 복원한 댓글도 수정됨으로 보인다. 수정 시각 컬럼이 생기면 그것으로 바꾼다
const edited = (c: CommentItem) => new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000;

const byCreated = (a: CommentItem, b: CommentItem) => a.created_at.localeCompare(b.created_at);

export function TaskComments({ task }: { task: TaskItem }) {
  const { members, meId } = useTasks();
  const { patchLocal } = useTaskActions();
  const [thread, setThread] = useState<CommentThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const me = byId.get(meId);

  useEffect(() => {
    let alive = true;
    void call(() => loadComments(task.id, task.project.id)).then((r) => {
      if (!alive) return;
      setNow(new Date());
      if (r.ok) {
        setThread(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [task.id, task.project.id, reload]);

  const setComments = useCallback(
    (update: (list: CommentItem[]) => CommentItem[]) => setThread((t) => (t ? { ...t, comments: update(t.comments) } : t)),
    [],
  );
  // 목록 카드의 댓글 수(삭제되지 않은 것만 센다). 실행 취소는 나중에 불리므로 그때의 개수를 ref로 읽는다
  const countRef = useRef(task.commentCount);
  useEffect(() => {
    countRef.current = task.commentCount;
  }, [task.commentCount]);
  const bump = (delta: number) => {
    countRef.current = Math.max(0, countRef.current + delta);
    patchLocal(task.id, { commentCount: countRef.current });
  };

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-(--r) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
        <span className="flex-1">댓글을 불러오지 못했습니다. {error}</span>
        <Button variant="outline" size="xs" onClick={() => setReload((n) => n + 1)}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (!thread) {
    return (
      <p aria-busy="true" className="text-(length:--fs-sm) text-(--text-3)">
        댓글을 불러오는 중…
      </p>
    );
  }

  const { comments, canComment, canManage } = thread;

  const submit = async (body: string, mentions: string[]) => {
    const r = await call(() => addComment(task.id, body, mentions));
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    setNow(new Date());
    setComments((list) => [...list, { ...r.data, authorId: meId, authorName: me?.name ?? null, reactions: [] }]);
    bump(1);
    announce("댓글을 남겼습니다");
    return true;
  };

  const saveEdit = async (c: CommentItem, body: string) => {
    if (body === c.body) {
      setEditing(null);
      return true;
    }
    const r = await call(() => editComment(c.id, body));
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    setComments((list) => list.map((x) => (x.id === c.id ? { ...x, body: r.data.body, updated_at: r.data.updated_at } : x)));
    setEditing(null);
    announce("댓글을 수정했습니다");
    return true;
  };

  const remove = async (c: CommentItem) => {
    setComments((list) => list.filter((x) => x.id !== c.id));
    const r = await call(() => deleteComment(c.id));
    if (!r.ok) {
      setComments((list) => [...list, c].sort(byCreated));
      toast.error(r.error);
      return;
    }
    bump(-1);
    // 지울 수 있었던 사람(작성자 본인 또는 관리 권한자)은 자기가 지운 댓글을 되살릴 수 있다(restore_comment)
    toast("댓글을 삭제했습니다", {
      action: {
        label: "실행 취소",
        onClick: async () => {
          const res = await call(() => restoreComment(c.id, r.data.token));
          if (!res.ok) return void toast.error(res.error);
          setComments((list) => [...list.filter((x) => x.id !== c.id), { ...c, updated_at: res.data.updated_at }].sort(byCreated));
          bump(1);
          toast.success("댓글을 되살렸습니다");
        },
      },
    });
  };

  const toggleReaction = async (c: CommentItem, emoji: CommentItem["reactions"][number]["emoji"], on: boolean) => {
    const apply = (add: boolean) =>
      setComments((list) =>
        list.map((x) => {
          if (x.id !== c.id) return x;
          const others = x.reactions.filter((r) => r.emoji !== emoji);
          const cur = x.reactions.find((r) => r.emoji === emoji)?.userIds ?? [];
          const userIds = add ? [...cur.filter((u) => u !== meId), meId] : cur.filter((u) => u !== meId);
          const next = userIds.length ? [...others, { emoji, userIds }] : others;
          return { ...x, reactions: sortReactions(next) };
        }),
      );
    apply(on);
    const r = await call(() => setReaction(c.id, emoji, on));
    if (!r.ok) {
      apply(!on);
      toast.error(r.error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <MessageSquare size={18} strokeWidth={1.8} aria-hidden className="text-(--text-4)" />
          <p className="text-(length:--fs-sm) text-(--text-3)">아직 댓글이 없습니다</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => {
            const author = c.authorId ? byId.get(c.authorId) : undefined;
            const name = author?.name ?? c.authorName ?? UNKNOWN_USER_LABEL;
            const mine = c.authorId === meId;
            const canEdit = canComment && mine;
            const canDelete = canComment && (mine || canManage);
            return (
              <li key={c.id} className="flex gap-2.5">
                <MemberAvatar name={name} color={author?.color} size={28} className="mt-0.5" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-(length:--fs-sm)">
                    <span className="truncate font-medium text-(--text)">{name}</span>
                    <time dateTime={c.created_at} className="shrink-0 text-(--text-3)">
                      {formatRelative(c.created_at, now)}
                    </time>
                    {edited(c) && <span className="shrink-0 text-(--text-4)">· 수정됨</span>}
                    {(canEdit || canDelete) && editing !== c.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" aria-label={`${name}님의 댓글 메뉴`} className="ml-auto text-(--text-3)">
                            <MoreHorizontal size={14} strokeWidth={1.8} aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {canEdit && (
                            <DropdownMenuItem onSelect={() => setEditing(c.id)}>
                              <Pencil size={14} strokeWidth={1.8} aria-hidden />
                              수정
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem variant="destructive" onSelect={() => void remove(c)}>
                              <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                              삭제
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {editing === c.id ? (
                    <CommentComposer
                      members={members}
                      label="댓글 수정"
                      submitLabel="저장"
                      initialValue={c.body}
                      autoFocus
                      onSubmit={(body) => saveEdit(c, body)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <CommentBody body={c.body} members={members} />
                  )}
                  <Reactions
                    reactions={c.reactions}
                    meId={meId}
                    nameOf={(id) => byId.get(id)?.name}
                    canReact={canComment}
                    onToggle={(emoji, on) => void toggleReaction(c, emoji, on)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canComment ? (
        <CommentComposer members={members} label="댓글 입력" onSubmit={submit} />
      ) : (
        <p className="rounded-(--r) bg-(--surface-2) px-3 py-2 text-(length:--fs-sm) text-(--text-3)">
          보기 권한만 있어 댓글을 남길 수 없습니다.
        </p>
      )}
    </div>
  );
}

// 고정 이모지 순서를 지킨다
function sortReactions(list: CommentItem["reactions"]) {
  return [...list].sort((a, b) => REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji));
}
