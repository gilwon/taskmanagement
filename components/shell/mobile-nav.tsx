"use client";
// 640px 이하 하단 고정 내비. 홈·내 작업·프로젝트·수신함·더 보기(META §8)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheckBig, Ellipsis, FolderKanban, House, Inbox, type LucideIcon } from "lucide-react";
import type { ShellData } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";

const itemClass =
  "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-(length:--fs-2xs) text-(--text-3) outline-none hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset aria-[current=page]:text-(--accent)";

export function MobileNav({ data, onOpenMore }: { data: ShellData; onOpenMore: () => void }) {
  const pathname = usePathname();
  const ws = data.workspace.slug;
  const items: { href: string; icon: LucideIcon; label: string; dot?: boolean }[] = [
    { href: `/${ws}/home`, icon: House, label: NAV_LABELS.home },
    { href: `/${ws}/my-tasks`, icon: CircleCheckBig, label: NAV_LABELS.myTasks },
    { href: `/${ws}/projects`, icon: FolderKanban, label: NAV_LABELS.projects },
    { href: `/${ws}/inbox`, icon: Inbox, label: NAV_LABELS.inbox, dot: data.counts.unread > 0 },
  ];

  return (
    <nav
      aria-label="하단 메뉴"
      className="only-m fixed inset-x-0 bottom-0 z-40 border-t border-(--border) bg-(--surface) pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {items.map(({ href, icon: Icon, label, dot }) => (
          <li key={href} className="flex flex-1">
            <Link href={href} aria-current={pathname === href ? "page" : undefined} className={itemClass}>
              <span className="relative">
                <Icon size={18} strokeWidth={1.8} aria-hidden />
                {dot && <span aria-hidden className="absolute -top-0.5 -right-1 size-2 rounded-full bg-(--red) ring-2 ring-(--surface)" />}
              </span>
              {label}
              {dot && <span className="sr-only">, 안 읽은 알림 있음</span>}
            </Link>
          </li>
        ))}
        <li className="flex flex-1">
          <button type="button" onClick={onOpenMore} className={itemClass} aria-haspopup="dialog">
            <Ellipsis size={18} strokeWidth={1.8} aria-hidden />
            {NAV_LABELS.more}
          </button>
        </li>
      </ul>
    </nav>
  );
}
