// 검색 결과 탭과 목록. 전체 탭은 종류별 섹션에 5개씩, 종류 탭은 그 종류 전부를 보인다
import Link from "next/link";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon } from "@/components/shell/project-icon";
import { StatusIcon } from "@/components/tasks/parts";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { SEARCH_SCOPES, type SearchResults, type SearchScope } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { Highlight } from "./highlight";
import { searchHref } from "./href";
import { SearchEmpty } from "./search-empty";

type Kind = Exclude<SearchScope, "all">;
const KINDS = SEARCH_SCOPES.filter((s): s is Kind => s !== "all");
const SECTION_SIZE = 5;

const rowClass =
  "flex min-w-0 items-center gap-2 rounded-(--r-sm) px-2 py-1.5 text-(length:--fs-base) text-(--text) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)";
const metaClass = "shrink-0 text-(length:--fs-sm) text-(--text-3)";

function Rows({
  kind,
  results,
  wsSlug,
  q,
  max,
  canOpenPeople,
  t,
}: {
  kind: Kind;
  results: SearchResults;
  wsSlug: string;
  q: string;
  max?: number;
  // 게스트는 구성원 화면이 403이라 사람 항목을 링크 없이 보인다
  canOpenPeople: boolean;
  t: T;
}) {
  const rows = (() => {
    switch (kind) {
      case "tasks":
        return results.tasks.slice(0, max).map((t) => (
          <Link key={t.id} href={`/${wsSlug}/task/${t.key}`} className={rowClass}>
            <StatusIcon status={t.status} />
            <span className="shrink-0 font-mono text-(length:--fs-sm) text-(--text-3)">
              <Highlight text={t.key} q={q} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <Highlight text={t.title} q={q} />
            </span>
            <span className={cn(metaClass, "hidden max-w-40 truncate sm:inline")}>{t.project.name}</span>
          </Link>
        ));
      case "projects":
        return results.projects.slice(0, max).map((p) => (
          <Link key={p.id} href={`/${wsSlug}/projects/${p.key}/overview`} className={rowClass}>
            <ProjectIcon icon={p.icon} color={p.color} size={18} />
            <span className="min-w-0 flex-1 truncate">
              <Highlight text={p.name} q={q} />
            </span>
            <span className={cn(metaClass, "font-mono")}>
              <Highlight text={p.key} q={q} />
            </span>
          </Link>
        ));
      case "people":
        return results.people.slice(0, max).map((m) => {
          const body = (
            <>
              <MemberAvatar name={m.name} color={m.color} size={22} />
              <span className="min-w-0 shrink truncate">
                <Highlight text={m.name} q={q} />
              </span>
              <span className="min-w-0 flex-1 truncate text-(length:--fs-sm) text-(--text-3)">
                <Highlight text={m.email} q={q} />
              </span>
              <span className={metaClass}>{t(`common.role.${m.role}`)}</span>
            </>
          );
          return canOpenPeople ? (
            <Link key={m.id} href={`/${wsSlug}/members/${m.id}`} className={rowClass}>
              {body}
            </Link>
          ) : (
            <div key={m.id} className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-(length:--fs-base) text-(--text)">
              {body}
            </div>
          );
        });
      case "files":
        return results.files.slice(0, max).map((f) => (
          <Link
            key={f.id}
            href={f.taskKey ? `/${wsSlug}/task/${f.taskKey}` : `/${wsSlug}/projects/${f.project.key}/files`}
            className={rowClass}
          >
            <span className="inline-flex h-5 shrink-0 items-center rounded-(--r-xs) bg-(--surface-2) px-1.5 text-(length:--fs-xs) text-(--text-2)">
              {t(`common.fileType.${f.type}`)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <Highlight text={f.name} q={q} />
            </span>
            <span className={cn(metaClass, "max-w-40 truncate")}>
              {f.project.name}
              {f.taskKey && <span className="font-mono"> · {f.taskKey}</span>}
            </span>
          </Link>
        ));
      case "comments":
        return results.comments.slice(0, max).map((c) => (
          <Link key={c.id} href={`/${wsSlug}/task/${c.taskKey}`} className={cn(rowClass, "flex-col items-stretch gap-0.5")}>
            <span className="line-clamp-2 break-words text-(--text-2)">
              <Highlight text={c.excerpt} q={q} />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-(length:--fs-sm) text-(--text-3)">
              <span className="shrink-0 font-mono">{c.taskKey}</span>
              <span className="min-w-0 truncate">{c.taskTitle}</span>
              <span className="shrink-0">· {c.authorName}</span>
            </span>
          </Link>
        ));
    }
  })();
  return <ul className="flex flex-col">{rows.map((r) => <li key={r.key} className="min-w-0">{r}</li>)}</ul>;
}

export async function SearchResultsView({
  wsSlug,
  q,
  tab,
  results,
  limit,
  canOpenPeople,
}: {
  wsSlug: string;
  q: string;
  tab: SearchScope;
  results: SearchResults;
  limit: number;
  canOpenPeople: boolean;
}) {
  const t = await getT();
  const count = (k: SearchScope) => (k === "all" ? KINDS.reduce((n, kk) => n + results[kk].length, 0) : results[k].length);
  // shortcut: 개수는 종류마다 limit개에서 잘린다. 정확한 총계가 필요해지면 count 쿼리를 따로 둔다
  const countLabel = (k: SearchScope) => {
    const n = count(k);
    const capped = k === "all" ? KINDS.some((kk) => results[kk].length >= limit) : n >= limit;
    return `${n}${capped ? "+" : ""}`;
  };
  const kindsShown = tab === "all" ? KINDS.filter((k) => results[k].length > 0) : [tab];

  return (
    <div className="flex min-w-0 flex-col gap-(--s-4) pb-(--s-8)">
      <div role="tablist" aria-label={t("search.scope")} className="flex flex-wrap gap-1 px-(--gutter)">
        {SEARCH_SCOPES.map((k) => {
          const selected = k === tab;
          return (
            <Link
              key={k}
              id={`search-tab-${k}`}
              role="tab"
              aria-selected={selected}
              aria-controls="search-panel"
              href={searchHref(wsSlug, q, k)}
              scroll={false}
              className={cn(
                "inline-flex h-(--h-sm) items-center gap-1.5 rounded-(--r-sm) px-2.5 text-(length:--fs-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                selected ? "bg-(--surface-3) font-medium text-(--text)" : "text-(--text-3) hover:bg-(--surface-2) hover:text-(--text)",
              )}
            >
              {t(`common.searchTab.${k}`)}
              <span className="tabular-nums text-(--text-3)">{countLabel(k)}</span>
            </Link>
          );
        })}
      </div>

      <div role="tabpanel" id="search-panel" aria-labelledby={`search-tab-${tab}`} className="min-w-0">
        {count(tab) === 0 ? (
          <SearchEmpty
            t={t}
            wsSlug={wsSlug}
            q={q}
            tab={tab}
            widenCount={tab !== "all" && count("all") > 0 ? countLabel("all") : null}
          />
        ) : tab === "all" ? (
          <div className="flex flex-col gap-(--s-6) px-(--gutter)">
            {kindsShown.map((k) => (
              <section key={k} aria-labelledby={`search-section-${k}`} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 px-2">
                  <h2 id={`search-section-${k}`} className="text-(length:--fs-sm) font-medium text-(--text-2)">
                    {t(`common.searchTab.${k}`)} <span className="tabular-nums text-(--text-3)">{countLabel(k)}</span>
                  </h2>
                  {results[k].length > SECTION_SIZE && (
                    <Link
                      href={searchHref(wsSlug, q, k)}
                      scroll={false}
                      className="rounded-(--r-xs) text-(length:--fs-sm) text-(--text-3) outline-none hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
                    >
                      {t("search.seeAll")}
                    </Link>
                  )}
                </div>
                <Rows kind={k} results={results} wsSlug={wsSlug} q={q} max={SECTION_SIZE} canOpenPeople={canOpenPeople} t={t} />
              </section>
            ))}
          </div>
        ) : (
          <div className="px-(--gutter)">
            <Rows kind={tab} results={results} wsSlug={wsSlug} q={q} canOpenPeople={canOpenPeople} t={t} />
          </div>
        )}
      </div>
    </div>
  );
}
