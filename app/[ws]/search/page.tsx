// 검색 화면. 작업·프로젝트·사람·파일·댓글을 ?q=&tab=으로 검색하고 최근 검색어를 칩으로 보인다
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { notFound } from "next/navigation";
import { SearchForm } from "@/components/search/search-form";
import { SearchResultsView } from "@/components/search/search-results";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { canOpenOrg } from "@/lib/org/queries";
import { getRecentSearches } from "@/lib/search/actions";
import { searchWorkspace } from "@/lib/search/queries";
import { normalizeQuery } from "@/lib/search/text";
import { isSearchScope, SEARCH_LIMIT_MAX } from "@/lib/search/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("common.nav.search") };
}

type Props = {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ q?: string | string[]; tab?: string | string[] }>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const [, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const q = normalizeQuery(sp.q);
  const tab = isSearchScope(sp.tab) ? sp.tab : "all";

  // 탭 개수를 한 번에 세려고 탭과 상관없이 전 종류를 최대 개수로 읽는다
  const [recent, results, canOpenPeople] = await Promise.all([
    getRecentSearches(workspace.id),
    q ? searchWorkspace(workspace.id, q, "all", SEARCH_LIMIT_MAX) : null,
    canOpenOrg(ws),
  ]);
  if (!recent.ok) throw new Error(recent.error);
  const t = await getT();

  return (
    <>
      <PageHeader title={t("common.nav.search")} subtitle={t("search.subtitle")} />
      <div className="flex min-w-0 flex-col gap-(--s-4)">
        <SearchForm key={q} workspace={{ id: workspace.id, slug: workspace.slug }} q={q} tab={tab} recent={recent.data} />
        {results ? (
          <SearchResultsView wsSlug={workspace.slug} q={q} tab={tab} results={results} limit={SEARCH_LIMIT_MAX} canOpenPeople={canOpenPeople} />
        ) : (
          <EmptyState icon={Search} title={t("search.emptyTitle")} description={t("search.emptyDescription")} />
        )}
      </div>
    </>
  );
}
