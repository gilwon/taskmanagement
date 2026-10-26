"use client";
// 탑바 검색. 누르면 바 전체로 늘어나는 검색창이 되고 아래로 최근 검색이 펼쳐지며, Enter·최근 검색 선택은 검색 화면으로 이동한다
// Lucian UX/UI Prompt #027 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#027
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { searchHref } from "@/components/search/href";
import { motionOff } from "@/lib/prefs/prefs";
import { useT } from "@/lib/i18n/client";
import { getRecentSearches, saveRecentSearch } from "@/lib/search/actions";
import { normalizeQuery, SEARCH_MAX_LEN } from "@/lib/search/text";
import "./lucian-search.css";

export function TopbarSearch({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: { id: string; slug: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const popId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  // 상단 바 안쪽 폭 전체와 검색 칸의 오른쪽 오프셋을 재서 CSS 변수로 넘긴다. 칸이 바 전체로 늘어나는 폭이다
  const measure = () => {
    const root = rootRef.current;
    const bar = root?.closest("header");
    if (!root || !bar) return;
    const b = bar.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    root.style.setProperty("--u027-w", `${b.width - padL - padR}px`);
    root.style.setProperty("--u027-r", `${r.right - (b.right - padR)}px`);
  };

  const openSearch = () => {
    measure();
    onOpenChange(true);
    void getRecentSearches(workspace.id).then((r) => {
      if (r.ok) setRecent(r.data);
      else toast.error(r.error);
    });
  };

  const close = () => {
    onOpenChange(false);
    setValue("");
    goRef.current?.focus();
  };

  // 열린 동안 바 폭이 바뀌면 다시 재고, 바깥을 누르면 닫는다. 열리면 입력창으로 포커스를 옮긴다
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
        setValue("");
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerdown", onDown);
    const id = window.setTimeout(() => inputRef.current?.focus(), motionOff() ? 0 : 120);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDown);
      window.clearTimeout(id);
    };
  }, [open, onOpenChange]);

  const go = (q: string) => {
    onOpenChange(false);
    setValue("");
    router.push(searchHref(workspace.slug, q, "all"));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = normalizeQuery(value);
    if (!query) {
      onOpenChange(false);
      router.push(`/${workspace.slug}/search`);
      return;
    }
    startTransition(async () => {
      // 최근 검색 저장이 실패해도 검색은 보여 준다. 저장을 먼저 끝내야 이동한 화면의 칩이 최신이다
      const r = await saveRecentSearch(workspace.id, query);
      if (!r.ok) toast.error(r.error);
      go(query);
    });
  };

  const q = value.trim().toLowerCase();
  const shown = recent.filter((s) => !q || s.toLowerCase().includes(q));

  return (
    <div
      ref={rootRef}
      className={`ux u027 ${open ? "is-open" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="u027-field">
        <button
          ref={goRef}
          type="button"
          className="u027-go"
          aria-label={t("shell.searchOpen")}
          aria-expanded={open}
          aria-controls={shown.length > 0 ? popId : undefined}
          onClick={() => (open ? inputRef.current?.focus() : openSearch())}
        >
          <Search aria-hidden />
          <span className="u027-hint" aria-hidden="true">
            {t("search.placeholder")}
          </span>
        </button>
        <form role="search" className="u027-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="u027-in"
            type="text"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={SEARCH_MAX_LEN}
            aria-label={t("search.queryLabel")}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            tabIndex={open ? 0 : -1}
          />
        </form>
        <button type="button" className="u027-x" aria-label={t("shell.searchClose")} tabIndex={open ? 0 : -1} onClick={close}>
          <X aria-hidden />
        </button>
      </div>
      {shown.length > 0 && (
        <div id={popId} className="u027-pop">
          <p className="u027-sec">{t("search.recent")}</p>
          <ul className="u027-recent">
            {shown.map((s) => (
              <li key={s} className="max-w-full min-w-0">
                <button type="button" onClick={() => go(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
