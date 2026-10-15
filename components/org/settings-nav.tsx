"use client";
// 설정 섹션 내비게이션. SETTINGS_SECTIONS를 그룹별로 묶고 현재 섹션에 aria-current를 단다. 미제공 섹션은 배지를 붙이고 역할로 막힌(403) 섹션은 뺀다
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Enums } from "@/lib/database.types";
import { SETTINGS_SECTIONS, UNAVAILABLE_LABEL, type SettingsSection } from "@/lib/i18n/labels";
import { canOpenSettingsSection } from "@/lib/org/rules";
import { cn } from "@/lib/utils";

const ALL_ENTRIES = Object.entries(SETTINGS_SECTIONS) as [SettingsSection, (typeof SETTINGS_SECTIONS)[SettingsSection]][];

export function SettingsNav({ wsSlug, role }: { wsSlug: string; role: Enums<"ws_role"> | null }) {
  const pathname = usePathname();
  const entries = ALL_ENTRIES.filter(([key]) => canOpenSettingsSection(role, key));
  const groups = [...new Set(entries.map(([, s]) => s.group))];
  return (
    <nav aria-label="설정 섹션" className="flex flex-wrap gap-x-6 gap-y-3 min-[901px]:flex-col min-[901px]:gap-y-4">
      {groups.map((group) => (
        <div key={group} className="min-w-0">
          <p className="mb-1 px-2 text-(length:--fs-2xs) font-medium text-(--text-3)">{group}</p>
          <ul className="flex flex-wrap gap-px min-[901px]:flex-col">
            {entries.filter(([, s]) => s.group === group).map(([key, s]) => {
              const href = `/${wsSlug}/settings/${key}`;
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    className={cn(
                      "flex h-(--side-row) items-center gap-2 rounded-(--r-sm) px-2 text-(length:--fs-base) whitespace-nowrap text-(--text-2) outline-none",
                      "hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)",
                      "aria-[current=page]:bg-(--surface-3) aria-[current=page]:font-medium aria-[current=page]:text-(--text)",
                    )}
                  >
                    {s.label}
                    {"unavailable" in s && (
                      <span className="rounded-(--r-xs) bg-(--surface-3) px-1 text-(length:--fs-2xs) text-(--text-3)">
                        {UNAVAILABLE_LABEL}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
