"use client";
// 캘린더 머리말 내비. 오늘·이전·다음·월 제목·프로젝트 범례·월/주 전환을 링크(?m=YYYY-MM, ?w=YYYY-MM-DD)로 바꾼다.
// 서버 페이지가 주소 값을 읽어 그 범위를 다시 조회하므로 새로고침·뒤로가기에서 보던 달이 유지된다
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatMonthTitle, seoulDay } from "@/lib/format/date";
import { colorHex } from "@/lib/i18n/labels";
import { addDays, addMonths, firstOfMonth, monthOf, startOfWeek, weekTitle } from "@/lib/schedule/dates";
import type { CalendarMode } from "@/lib/schedule/types";
import { cn } from "@/lib/utils";

const rangeFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });
const ICON = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;
const BTN =
  "inline-flex h-(--h-md) items-center justify-center rounded-(--r-sm) border border-(--border) bg-(--surface) text-(length:--fs-sm) text-(--text-2) outline-none hover:bg-(--surface-2) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)";

export function CalendarNav({
  anchor,
  mode,
  todayIso,
  legend,
}: {
  anchor: string;
  mode: CalendarMode;
  todayIso: string;
  legend?: { id: string; name: string; color: string }[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  // 드로어(?task=) 등 다른 값은 지우고 보는 범위만 바꾼다
  const href = (next: { m: string } | { w: string }) => {
    const q = new URLSearchParams(params.toString());
    q.delete("m");
    q.delete("w");
    q.delete("task");
    if ("m" in next) q.set("m", next.m);
    else q.set("w", next.w);
    return `${pathname}?${q.toString()}`;
  };
  const week = mode === "week";
  const todayHref = week ? href({ w: startOfWeek(todayIso) }) : href({ m: monthOf(todayIso) });
  const prev = week ? href({ w: addDays(anchor, -7) }) : href({ m: monthOf(addMonths(anchor, -1)) });
  const next = week ? href({ w: addDays(anchor, 7) }) : href({ m: monthOf(addMonths(anchor, 1)) });
  // 주 보기로 바꾸면 이번 달이면 오늘이 든 주, 아니면 그 달 첫 주
  const weekHref = href({ w: startOfWeek(monthOf(anchor) === monthOf(todayIso) ? todayIso : firstOfMonth(anchor)) });
  const monthHref = href({ m: monthOf(anchor) });
  const title = week ? weekTitle(anchor) : formatMonthTitle(anchor);
  const weekRange = `${rangeFmt.format(new Date(seoulDay(anchor)))} – ${rangeFmt.format(new Date(seoulDay(addDays(anchor, 6))))}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-(--gutter) pb-(--s-3)">
      <div className="flex items-center gap-1">
        <Link href={todayHref} scroll={false} className={cn(BTN, "px-2.5")}>
          오늘
        </Link>
        <Link href={prev} scroll={false} aria-label={week ? "이전 주" : "이전 달"} className={cn(BTN, "w-(--h-md)")}>
          <ChevronLeft {...ICON} />
        </Link>
        <Link href={next} scroll={false} aria-label={week ? "다음 주" : "다음 달"} className={cn(BTN, "w-(--h-md)")}>
          <ChevronRight {...ICON} />
        </Link>
      </div>
      <h2 className="text-(length:--fs-lg) font-semibold text-(--text)">
        {title}
        {week && <span className="ml-2 text-(length:--fs-sm) font-normal text-(--text-3)">{weekRange}</span>}
      </h2>
      {legend && legend.length > 0 && (
        <ul aria-label="프로젝트 범례" className="hide-m flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 text-(length:--fs-xs) text-(--text-3)">
              <span aria-hidden className="size-2 rounded-full" style={{ background: colorHex(p.color) }} />
              {p.name}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="보기 단위" className="ml-auto flex rounded-(--r-sm) border border-(--border) bg-(--surface) p-0.5">
        {(
          [
            ["month", "월", monthHref],
            ["week", "주", weekHref],
          ] as const
        ).map(([m, label, to]) => (
          <Link
            key={m}
            href={to}
            scroll={false}
            aria-current={mode === m ? "page" : undefined}
            className={cn(
              "inline-flex h-(--h-sm) items-center rounded-(--r-xs) px-3 text-(length:--fs-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
              mode === m ? "bg-(--surface-3) font-medium text-(--text)" : "text-(--text-3) hover:text-(--text)",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
