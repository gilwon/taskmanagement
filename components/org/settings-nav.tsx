"use client";
// 설정 섹션 내비게이션. SETTINGS_SECTIONS를 그룹별로 묶고 현재 섹션에 aria-current를 단다. 미제공 섹션은 배지를 붙이고 역할로 막힌(403) 섹션은 뺀다
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Enums } from "@/lib/database.types";
import { useT } from "@/lib/i18n/client";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/i18n/labels";
import { canOpenSettingsSection } from "@/lib/org/rules";
import { cn } from "@/lib/utils";

const ALL_ENTRIES = Object.entries(SETTINGS_SECTIONS) as [SettingsSection, (typeof SETTINGS_SECTIONS)[SettingsSection]][];

export function SettingsNav({ wsSlug, role }: { wsSlug: string; role: Enums<"ws_role"> | null }) {
  const t = useT();
  const pathname = usePathname();
  const entries = ALL_ENTRIES.filter(([key]) => canOpenSettingsSection(role, key));
  const groups = [...new Set(entries.map(([, s]) => s.group))];
  return (
    <nav aria-label={t("org.settings.navLabel")} className="flex flex-wrap gap-x-6 gap-y-3 min-[901px]:flex-col min-[901px]:gap-y-4">
      {groups.map((group) => {
        const items = entries.filter(([, s]) => s.group === group);
        return (
          <div key={group} className="min-w-0">
            {/* 묶음은 group 문자열로 하고 화면 표시는 첫 섹션의 그룹 이름 사전 값으로 한다 */}
            <p className="mb-1 px-2 text-(length:--fs-2xs) font-medium text-(--text-3)">{t(`org.settings.groupOf.${items[0][0]}`)}</p>
            <ul className="flex flex-wrap gap-px min-[901px]:flex-col">
              {items.map(([key, s]) => {
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
                      {t(`org.settings.section.${key}`)}
                      {"unavailable" in s && (
                        <span className="rounded-(--r-xs) bg-(--surface-3) px-1 text-(length:--fs-2xs) text-(--text-3)">
                          {t("common.unavailable")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
