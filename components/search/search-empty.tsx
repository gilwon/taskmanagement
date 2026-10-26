// 검색 결과 없음 안내. 좁힌 검색 범위를 칩으로 보이고, 범위를 풀면 나오는 결과가 있으면 풀기 링크를 준다
// Lucian UX/UI Prompt #092 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#092
import Link from "next/link";
import type { CSSProperties } from "react";
import type { T } from "@/lib/i18n/t";
import type { SearchScope } from "@/lib/search/types";
import { searchHref } from "./href";
import "./lucian-search.css";

export function SearchEmpty({
  t,
  wsSlug,
  q,
  tab,
  widenCount,
}: {
  t: T;
  wsSlug: string;
  q: string;
  tab: SearchScope;
  // 범위를 풀면 나오는 결과 수 문구(잘리면 "50+"). 풀어도 없거나 이미 전체면 null
  widenCount: string | null;
}) {
  const scope = t(`common.searchTab.${tab}`);
  const widenHref = searchHref(wsSlug, q, "all");
  return (
    <div className="px-(--gutter)">
      <div className="ux u092 mx-auto">
        {tab !== "all" && (
          <div className="u092-fs" role="group" aria-label={t("search.scopeFilters")}>
            <Link href={widenHref} scroll={false} className="u092-ch" aria-label={t("search.removeScope", { scope })}>
              <span>{scope}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 5l6 6M11 5l-6 6" />
              </svg>
            </Link>
          </div>
        )}
        <div className="u092-none">
          <div className="u092-art" aria-hidden="true">
            <svg viewBox="0 0 150 92">
              <path className="u092-shelf" d="M8 30h134M8 56h134M8 82h134" />
              <g className="u092-lens">
                <circle cx="34" cy="38" r="20" />
                <path className="gl" d="M24 30a12 12 0 0 1 8-5" />
                <path d="M48 52l14 14" />
              </g>
            </svg>
          </div>
          <p className="u092-nt">{t("search.noResultsTitle")}</p>
          <p className="u092-ns">{t("search.noResultsDescription", { q })}</p>
          {widenCount && (
            <div className="u092-sgs">
              <Link
                href={widenHref}
                scroll={false}
                className="u092-sg"
                style={{ "--i": 0 } as CSSProperties}
                aria-label={t("search.widenAria", { scope, n: widenCount })}
              >
                <s>{scope}</s>
                <span>
                  {t("search.widen")} <b>{t("search.widenCount", { n: widenCount })}</b>
                </span>
                <svg viewBox="0 0 15 15" aria-hidden="true">
                  <path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
