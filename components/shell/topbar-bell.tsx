"use client";
// 탑바 알림 벨. 누르면 최근 알림 목록이 벨 아래로 펼쳐지고, 항목·모두 읽음·모두 보기를 제공한다
// Lucian UX/UI Prompt #074 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#074
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { NotificationLine, useNotificationState } from "@/components/notifications/notification-parts";
import { useT } from "@/lib/i18n/client";
import { getRecentNotifications } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/queries";
import "./lucian-bell.css";

// 목록을 아직 못 가져왔을 때 훅에 넘기는 고정 빈 배열(참조가 바뀌면 읽음 덧씌움이 초기화된다)
const EMPTY: NotificationItem[] = [];

export function TopbarBell({ workspace, unread, className }: { workspace: { id: string; slug: string }; unread: number; className?: string }) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { items, markAll, openItem } = useNotificationState(list ?? EMPTY, workspace.id);
  const unreadShown = items.filter((n) => !n.read).length;

  // 열 때마다 서버에서 최근 알림을 새로 가져온다
  const load = async () => {
    const r = await getRecentNotifications(workspace.id).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    if (r.ok) {
      setList(r.data);
      setError(null);
      setNow(new Date());
    } else {
      setError(r.error);
      toast.error(r.error);
    }
  };

  const toggle = () => {
    if (!open) void load();
    setOpen(!open);
  };

  // 열려 있는 동안 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div
      ref={rootRef}
      className={`ux u074 ${open ? "" : "is-closed"} ${className ?? ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          bellRef.current?.focus();
        }
      }}
    >
      <button
        ref={bellRef}
        type="button"
        className="u074-bell"
        aria-expanded={open}
        aria-controls="topbar-bell-panel"
        aria-label={unread ? t("shell.notificationsUnread", { count: unread }) : t("common.nav.notifications")}
        onClick={toggle}
      >
        <svg viewBox="0 0 22 22" aria-hidden="true">
          <path d="M5.5 15V10a5.5 5.5 0 0 1 11 0v5l1.5 1.5h-14zM9 18.5a2 2 0 0 0 4 0" />
        </svg>
        <span className={`u074-badge ${unread ? "" : "zero"}`} aria-hidden="true">
          {badge}
        </span>
      </button>
      <div id="topbar-bell-panel" className="u074-pan" role="region" aria-label={t("shell.bellListLabel")} inert={!open}>
        <div className="u074-ph">
          <b className="u074-ttl">{t("common.nav.notifications")}</b>
          <button type="button" className="u074-all" disabled={unreadShown === 0} onClick={() => void markAll()}>
            {t("notifications.markAllRead")}
          </button>
        </div>
        {error ? (
          <p className="u074-msg" role="alert">
            {error}
          </p>
        ) : list === null ? (
          <p className="u074-msg">{t("shell.bellLoading")}</p>
        ) : items.length === 0 ? (
          <p className="u074-msg">{t("shell.bellEmpty")}</p>
        ) : (
          <ul className="u074-list" aria-live="polite">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`u074-row ${n.read ? "read" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    void openItem(workspace.slug, n);
                  }}
                >
                  <NotificationLine n={n} now={now} color={undefined} compact />
                  <span className="u074-dot" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="u074-foot">
          <Link href={`/${workspace.slug}/notifications`} className="u074-more" onClick={() => setOpen(false)}>
            {t("shell.bellViewAll")}
          </Link>
        </div>
      </div>
    </div>
  );
}
