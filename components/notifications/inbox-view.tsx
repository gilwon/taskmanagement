"use client";
// 수신함 본문. 왼쪽 420px 목록(종류 탭·읽지 않음만 보기·모두 읽음)과 오른쪽 미리보기(작업 열기·답글·읽지 않음으로 표시).
// 항목을 고르면 읽음으로 표시한다. 900px 이하에서는 목록과 미리보기를 번갈아 보인다
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, Inbox, MailOpen, MessageSquareReply, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shell/empty-state";
import {
  NotificationLine,
  UnreadDot,
  notificationHref,
  useNotificationState,
} from "@/components/notifications/notification-parts";
import type { Enums } from "@/lib/database.types";
import { useT } from "@/lib/i18n/client";
import { INBOX_TAB_LABELS } from "@/lib/i18n/labels";
import type { NotificationItem } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";

type Tab = keyof typeof INBOX_TAB_LABELS;
const TABS = Object.keys(INBOX_TAB_LABELS) as Tab[];

type Props = {
  initial: NotificationItem[];
  workspace: { id: string; slug: string };
  colors: Record<string, string>;
  nowIso: string;
};

export function InboxView({ initial, workspace, colors, nowIso }: Props) {
  const t = useT();
  const { items, set, markAll } = useNotificationState(initial, workspace.id);
  const [tab, setTab] = useState<Tab>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const shown = items.filter(
    (n) => (tab === "all" || n.type === (tab as Enums<"notification_type">)) && (!unreadOnly || !n.read || n.id === selectedId),
  );
  const selected = items.find((n) => n.id === selectedId) ?? null;
  const unread = items.filter((n) => !n.read).length;

  const select = (n: NotificationItem) => {
    setSelectedId(n.id);
    if (!n.read) void set([n.id], true);
  };

  const href = selected ? notificationHref(workspace.slug, selected) : null;

  return (
    <div className="grid min-h-0 grid-cols-[420px_minmax(0,1fr)] gap-(--s-4) px-(--gutter) pb-(--s-8) max-[901px]:grid-cols-1">
      <section aria-label={t("notifications.inboxList")} className={cn("flex min-w-0 flex-col gap-(--s-3)", selected && "max-[901px]:hidden")}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
            {TABS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`common.inboxTab.${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch id="inbox-unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            <Label htmlFor="inbox-unread" className="text-(length:--fs-sm) text-(--text-2)">
              {t("notifications.unreadOnly")}
            </Label>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void markAll()} disabled={unread === 0}>
            <CheckCheck size={14} strokeWidth={1.8} aria-hidden />
            {t("notifications.markAllRead")}
          </Button>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Inbox} title={t("notifications.allCaughtUp")} description={t("notifications.inboxEmpty")} />
        ) : (
          <ul className="flex flex-col rounded-(--r-lg) border border-(--border) bg-(--surface)">
            {shown.map((n) => (
              <li key={n.id} className="border-b border-(--divider) last:border-b-0">
                <button
                  type="button"
                  aria-current={n.id === selectedId ? "true" : undefined}
                  onClick={() => select(n)}
                  className={cn(
                    "flex w-full gap-2 px-(--s-3) py-(--s-3) text-left outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset",
                    n.id === selectedId ? "bg-(--accent-soft)" : "hover:bg-(--surface-2)",
                  )}
                >
                  <UnreadDot read={n.read} />
                  <NotificationLine n={n} now={now} color={n.actorId ? colors[n.actorId] : undefined} compact />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label={t("notifications.preview")}
        className={cn(
          "min-w-0 self-start rounded-(--r-lg) border border-(--border) bg-(--surface) p-(--s-5)",
          !selected && "max-[901px]:hidden",
        )}
      >
        {selected ? (
          <div className="flex flex-col gap-(--s-4)">
            <Button variant="ghost" size="sm" className="self-start min-[901px]:hidden" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={14} strokeWidth={1.8} aria-hidden />
              {t("notifications.backToList")}
            </Button>
            <NotificationLine n={selected} now={now} color={selected.actorId ? colors[selected.actorId] : undefined} />
            <div className="flex flex-wrap gap-2">
              {href && (
                <Button asChild size="sm">
                  <Link href={href}>
                    <SquareArrowOutUpRight size={14} strokeWidth={1.8} aria-hidden />
                    {selected.task ? t("notifications.openTask") : t("notifications.openProject")}
                  </Link>
                </Button>
              )}
              {href && selected.task && (
                // 답글은 작업 페이지의 댓글 입력창에서 쓴다. ?compose=1이면 입력창에 포커스한다(task-comments)
                <Button asChild size="sm" variant="outline">
                  <Link href={`${href}?compose=1`}>
                    <MessageSquareReply size={14} strokeWidth={1.8} aria-hidden />
                    {t("notifications.reply")}
                  </Link>
                </Button>
              )}
              {selected.read && (
                <Button size="sm" variant="ghost" onClick={() => void set([selected.id], false)}>
                  <MailOpen size={14} strokeWidth={1.8} aria-hidden />
                  {t("notifications.markUnread")}
                </Button>
              )}
            </div>
            {!href && (
              <p className="text-(length:--fs-sm) text-(--text-3)">{t("notifications.targetGone")}</p>
            )}
          </div>
        ) : (
          <p className="py-(--s-8) text-center text-(length:--fs-sm) text-(--text-3)">{t("notifications.pickHint")}</p>
        )}
      </section>
    </div>
  );
}
