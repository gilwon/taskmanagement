"use client";
// 구성원·팀·역할과 권한 화면을 오가는 링크 탭. 화면 이동이라 tablist가 아닌 nav와 aria-current를 쓴다
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function OrgTabs({ wsSlug }: { wsSlug: string }) {
  const t = useT();
  const pathname = usePathname();
  const tabs = [
    { href: `/${wsSlug}/members`, label: t("common.nav.members") },
    { href: `/${wsSlug}/teams`, label: t("common.nav.teams") },
    { href: `/${wsSlug}/members/roles`, label: t("org.permissions.title") },
  ];
  return (
    <nav aria-label={t("org.tabs.navLabel")} className="px-(--gutter) pb-(--s-4)">
      <ul className="flex gap-1 border-b border-(--border)">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={pathname === tab.href ? "page" : undefined}
              className={cn(
                "-mb-px flex h-(--h-md) items-center border-b-2 border-transparent px-3 text-(length:--fs-base) whitespace-nowrap text-(--text-3) outline-none",
                "hover:text-(--text) focus-visible:rounded-(--r-xs) focus-visible:ring-2 focus-visible:ring-(--accent)",
                "aria-[current=page]:border-(--accent) aria-[current=page]:font-medium aria-[current=page]:text-(--text)",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
