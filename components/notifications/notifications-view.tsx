"use client";
// 알림 화면 본문. 전체·읽지 않음 탭, 날짜 묶음(오늘·어제·이번 주·이전), 모두 읽음. 행을 누르면 읽음으로 표시하고 대상으로 간다
import { useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shell/empty-state";
import { NotificationLine, UnreadDot, useNotificationState } from "@/components/notifications/notification-parts";
import { NOTIFICATION_FILTER_LABELS, NOTIFICATION_GROUP_LABELS } from "@/lib/i18n/labels";
import { groupInOrder, notificationGroup } from "@/lib/notifications/groups";
import type { NotificationItem } from "@/lib/notifications/queries";

type Filter = keyof typeof NOTIFICATION_FILTER_LABELS;

type Props = {
  initial: NotificationItem[];
  workspace: { id: string; slug: string };
  colors: Record<string, string>;
  nowIso: string;
};

export function NotificationsView({ initial, workspace, colors, nowIso }: Props) {
  const { items, markAll, openItem } = useNotificationState(initial, workspace.id);
  const [filter, setFilter] = useState<Filter>("all");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const unread = items.filter((n) => !n.read).length;

  const list = (f: Filter) => {
    const shown = f === "unread" ? items.filter((n) => !n.read) : items;
    if (shown.length === 0) {
      return (
        <EmptyState
          icon={Bell}
          title={f === "unread" ? "모두 확인했습니다" : "알림이 없습니다"}
          description={f === "unread" ? "읽지 않은 알림이 없습니다." : "멘션·담당자 지정·댓글 알림이 여기에 모입니다."}
        />
      );
    }
    return (
      <div className="flex flex-col gap-(--s-5) px-(--gutter)">
        {groupInOrder(shown, (n) => notificationGroup(n.created_at, now)).map((g) => (
          <section key={g.key} aria-label={NOTIFICATION_GROUP_LABELS[g.key]} className="flex flex-col gap-1">
            <h2 className="text-(length:--fs-xs) font-semibold text-(--text-3)">{NOTIFICATION_GROUP_LABELS[g.key]}</h2>
            <ul className="flex flex-col rounded-(--r-lg) border border-(--border) bg-(--surface)">
              {g.items.map((n) => (
                <li key={n.id} className="border-b border-(--divider) last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void openItem(workspace.slug, n)}
                    className="flex w-full gap-2 px-(--s-4) py-(--s-3) text-left outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
                  >
                    <UnreadDot read={n.read} />
                    <NotificationLine n={n} now={now} color={n.actorId ? colors[n.actorId] : undefined} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  };

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="gap-(--s-4) pb-(--s-8)">
      <div className="flex flex-wrap items-center gap-2 px-(--gutter)">
        <TabsList>
          <TabsTrigger value="all">{NOTIFICATION_FILTER_LABELS.all}</TabsTrigger>
          <TabsTrigger value="unread">
            {NOTIFICATION_FILTER_LABELS.unread}
            {unread > 0 && ` (${unread})`}
          </TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void markAll()} disabled={unread === 0}>
          <CheckCheck size={14} strokeWidth={1.8} aria-hidden />
          모두 읽음으로 표시
        </Button>
      </div>
      <TabsContent value="all">{list("all")}</TabsContent>
      <TabsContent value="unread">{list("unread")}</TabsContent>
    </Tabs>
  );
}
