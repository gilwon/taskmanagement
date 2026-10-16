"use client";
// 검색 화면 상단 입력과 최근 검색 칩. 제출하면 최근 검색어를 저장한 뒤 URL(?q=&tab=)로 이동한다
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { saveRecentSearch } from "@/lib/search/actions";
import { normalizeQuery, SEARCH_MAX_LEN } from "@/lib/search/text";
import type { SearchScope } from "@/lib/search/types";
import { searchHref } from "./href";

export function SearchForm({
  workspace,
  q,
  tab,
  recent,
}: {
  workspace: { id: string; slug: string };
  q: string;
  tab: SearchScope;
  recent: string[];
}) {
  const router = useRouter();
  const t = useT();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = normalizeQuery(value);
    if (!query) {
      router.push(`/${workspace.slug}/search`);
      return;
    }
    startTransition(async () => {
      // 최근 검색 저장이 실패해도 검색은 보여 준다. 저장을 먼저 끝내야 이동한 화면의 칩이 최신이다
      const r = await saveRecentSearch(workspace.id, query);
      if (!r.ok) toast.error(r.error);
      router.push(searchHref(workspace.slug, query, tab));
    });
  };

  return (
    <div className="flex flex-col gap-(--s-3) px-(--gutter)">
      <form role="search" onSubmit={submit} className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--text-3)"
          />
          <Input
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={SEARCH_MAX_LEN}
            aria-label={t("search.queryLabel")}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            className="h-(--h-md) rounded-(--r-sm) pl-8"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("search.submit")}
        </Button>
      </form>
      {recent.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-(length:--fs-sm) text-(--text-3)">{t("search.recent")}</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {recent.map((s) => (
              <li key={s} className="min-w-0">
                <Link
                  href={searchHref(workspace.slug, s, tab)}
                  className="inline-flex h-(--h-sm) max-w-60 items-center truncate rounded-full border border-(--border) px-2.5 text-(length:--fs-sm) text-(--text-2) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  <span className="truncate">{s}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
