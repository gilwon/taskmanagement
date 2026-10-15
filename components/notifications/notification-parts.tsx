"use client";
// 알림 화면·수신함이 함께 쓰는 조각. 알림 한 줄 문장, 이동 주소, 읽음 처리 훅
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { announce } from "@/components/tasks/views/shared";
import { formatRelative } from "@/lib/format/date";
import { DELETED_TASK_LABEL, NOTIFICATION_TYPE_LABELS, UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import { markAllNotificationsRead, markNotifications } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/queries";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { cn } from "@/lib/utils";

// 알림 대상 주소. 작업이 있으면 작업 페이지, 없으면 프로젝트 개요. 삭제됐거나 볼 수 없으면 null
export function notificationHref(ws: string, n: NotificationItem) {
  if (n.task && !n.task.deleted) return `/${ws}/task/${n.task.key}`;
  if (!n.task && n.project) return `/${ws}/projects/${n.project.key}/overview`;
  return null;
}

// 서버 목록에 화면의 읽음 상태를 덧씌운다. 서버가 새 목록을 주면(refresh) 덧씌운 값을 버린다
export function useNotificationState(initial: NotificationItem[], workspaceId: string) {
  const router = useRouter();
  const [prev, setPrev] = useState(initial);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  if (prev !== initial) {
    setPrev(initial);
    setOverrides({});
  }
  const items = initial.map((n) => (n.id in overrides ? { ...n, read: overrides[n.id] } : n));

  const set = async (ids: string[], read: boolean) => {
    if (ids.length === 0) return true;
    setOverrides((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, read])) }));
    const r = await markNotifications(ids, read).catch((e: unknown) => ({
      ok: false as const,
      error: taskErrorMessage({ message: String(e) }),
    }));
    if (!r.ok) {
      setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([id]) => !ids.includes(id))));
      toast.error(r.error);
      return false;
    }
    return true;
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    setOverrides((o) => ({ ...o, ...Object.fromEntries(unread.map((id) => [id, true])) }));
    const r = await markAllNotificationsRead(workspaceId).catch((e: unknown) => ({
      ok: false as const,
      error: taskErrorMessage({ message: String(e) }),
    }));
    if (!r.ok) {
      setOverrides({});
      toast.error(r.error);
      return;
    }
    announce("알림을 모두 읽음으로 표시했습니다");
  };

  // 읽음으로 표시한 뒤 대상으로 이동한다. refresh가 끝난 뒤 이동해야 탑바 개수가 맞는다
  const openItem = async (ws: string, n: NotificationItem) => {
    if (!n.read) await set([n.id], true);
    const href = notificationHref(ws, n);
    if (href) router.push(href);
  };

  return { items, set, markAll, openItem };
}

export function NotificationLine({
  n,
  now,
  color,
  compact = false,
}: {
  n: NotificationItem;
  now: Date;
  color: string | undefined;
  compact?: boolean;
}) {
  const actor = n.actorName ?? UNKNOWN_USER_LABEL;
  return (
    <div className="flex min-w-0 flex-1 gap-2.5">
      <MemberAvatar name={actor} color={color} size={28} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-(length:--fs-sm) leading-snug text-(--text-2)", !n.read && "text-(--text)")}>
          <span className="font-semibold text-(--text)">{actor}</span>님이 {n.text}
        </p>
        {(n.task || n.project) && (
          <p className="truncate text-(length:--fs-sm) font-medium text-(--text)">
            {n.task ? (n.task.deleted ? DELETED_TASK_LABEL : n.task.title) : n.project?.name}
            {n.task && <span className="ml-1.5 font-mono text-(length:--fs-xs) font-normal text-(--text-3)">{n.task.key}</span>}
          </p>
        )}
        {n.snippet && (
          <p className={cn("text-(length:--fs-sm) text-(--text-3)", compact ? "truncate" : "line-clamp-2")}>{n.snippet}</p>
        )}
        <p className="text-(length:--fs-xs) text-(--text-3)">
          {NOTIFICATION_TYPE_LABELS[n.type]} · <time dateTime={n.created_at}>{formatRelative(n.created_at, now)}</time>
        </p>
      </div>
    </div>
  );
}

// 읽지 않은 알림 점
export function UnreadDot({ read }: { read: boolean }) {
  return read ? (
    <span aria-hidden className="mt-2 size-2 shrink-0" />
  ) : (
    <span role="img" aria-label="읽지 않음" className="mt-2 size-2 shrink-0 rounded-full bg-(--accent)" />
  );
}
