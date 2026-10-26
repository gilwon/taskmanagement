"use client";
// 이력 필터의 기간 선택 달력(Lucian #030). 시작일을 누르고 끝날짜를 누르면 기간이 정해지고, 적용하면 onApply로 YYYY-MM-DD를 넘긴다
// Lucian UX/UI Prompt #030 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#030
import { useEffect, useMemo, useRef, useState } from "react";
import "./lucian-range.css";
import { useFormatter, useLocale, useT } from "@/lib/i18n/client";
import {
  MAX_YEAR,
  MIN_YEAR,
  daysInclusive,
  keyDay,
  keyMonth,
  keyToYmd,
  keyYear,
  monthCells,
  shiftKey,
  toKey,
  ymdToKey,
} from "@/lib/inventory/range-calendar";
import { seoulDay } from "@/lib/i18n/format";
import { motionOff } from "@/lib/prefs/prefs";

// 넘어가는 달 날짜판·제목을 치우는 시간(원본 460ms)
const SLIDE_MS = 460;

// 보이는 달 하나. ym은 연*12+월(0부터), dir은 넘어온 방향, out은 밀려나가는 중, enter는 막 들어와 시작 위치에 있는 중
type View = { id: number; ym: number; dir: number; out: boolean; enter: boolean };

export function RangeCalendar({
  from,
  to,
  onApply,
}: {
  from: string | undefined;
  to: string | undefined;
  onApply: (from: string, to: string | null) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatter();
  const rootRef = useRef<HTMLDivElement>(null);

  // 기존 기간이 있으면 정렬해 시작·종료로 쓰고, 달력은 시작일의 달에서 연다
  const [init] = useState(() => {
    const a = ymdToKey(from);
    const b = ymdToKey(to);
    const s = a ?? null;
    const e = a !== null && b !== null ? b : null;
    const [lo, hi] = s !== null && e !== null && e < s ? [e, s] : [s, e];
    const today = seoulDay(new Date());
    const td = new Date(today);
    const todayKey = toKey(td.getUTCFullYear(), td.getUTCMonth(), td.getUTCDate());
    const open = lo ?? b ?? todayKey;
    return { start: lo, end: hi, todayKey, ym: keyYear(open) * 12 + keyMonth(open) };
  });
  const [start, setStart] = useState<number | null>(init.start);
  const [end, setEnd] = useState<number | null>(init.end);
  const [hover, setHover] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [views, setViews] = useState<View[]>([{ id: 0, ym: init.ym, dir: 0, out: false, enter: false }]);
  const seq = useRef(0);
  const focusPending = useRef(false);

  const cur = views.find((v) => !v.out) ?? views[0];

  // 날짜 표기는 앱 로캘을 따른다. 다른 해의 날짜에만 연도를 붙인다
  const fmts = useMemo(() => {
    const opt = { timeZone: "UTC" } as const;
    return {
      pill: new Intl.DateTimeFormat(locale, { ...opt, month: "short", day: "numeric", weekday: "short" }),
      pillYear: new Intl.DateTimeFormat(locale, { ...opt, year: "numeric", month: "short", day: "numeric", weekday: "short" }),
      full: new Intl.DateTimeFormat(locale, { ...opt, year: "numeric", month: "long", day: "numeric", weekday: "long" }),
      wk: new Intl.DateTimeFormat(locale, { ...opt, weekday: "short" }),
    };
  }, [locale]);
  const dateOf = (k: number) => new Date(Date.UTC(keyYear(k), keyMonth(k), keyDay(k)));
  const pillLabel = (k: number) => (keyYear(k) === keyYear(init.todayKey) ? fmts.pill : fmts.pillYear).format(dateOf(k));
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmts.wk.format(new Date(Date.UTC(2023, 0, 1 + i)))), [fmts]);

  // 달을 옮긴다. 새 날짜판은 방향 쪽에서 들어오고 이전 것은 반대쪽으로 밀려난 뒤 치운다
  function goto(ym: number, dir: number) {
    if (ym < MIN_YEAR * 12 || ym >= (MAX_YEAR + 1) * 12) return;
    const id = ++seq.current;
    if (motionOff()) {
      setViews([{ id, ym, dir: 0, out: false, enter: false }]);
      return;
    }
    setViews((vs) => [...vs.filter((v) => !v.out).map((v) => ({ ...v, out: true, dir })), { id, ym, dir, out: false, enter: true }]);
    window.setTimeout(() => setViews((vs) => vs.filter((v) => v.id >= id)), SLIDE_MS);
  }

  // 시작일 → 끝날짜 순으로 고른다. 이미 기간이 있으면 다시 시작일부터 고른다. 시작일을 한 번 더 누르면 하루짜리 기간이다
  function pick(k: number) {
    if (start === null || end !== null) {
      setStart(k);
      setEnd(null);
    } else if (k === start) setEnd(k);
    else {
      setEnd(Math.max(k, start));
      setStart(Math.min(k, start));
    }
    setHover(null);
    setFocusKey(k);
  }

  // 달이 바뀐 뒤 키보드로 옮긴 날짜에 포커스를 둔다
  useEffect(() => {
    if (!focusPending.current || focusKey === null) return;
    focusPending.current = false;
    rootRef.current?.querySelector<HTMLButtonElement>(`.u030-grid:not(.is-out) [data-k="${focusKey}"]`)?.focus();
  }, [focusKey, views]);

  const hi = end !== null ? end : start !== null && hover !== null ? hover : null;
  const [lo, top] = start !== null && hi !== null && hi < start ? [hi, start] : [start, hi];

  // 포커스를 받을 날짜 하나. 직전에 고른 날, 시작일, 그 달 1일 순이다
  const y = Math.floor(cur.ym / 12);
  const m = cur.ym % 12;
  const inMonth = (k: number | null) => k !== null && keyYear(k) === y && keyMonth(k) === m;
  const rovingKey = inMonth(focusKey) ? focusKey : inMonth(start) ? start : toKey(y, m, 1);

  function onKeyDown(e: React.KeyboardEvent) {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".u030-d");
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!b || !step) return;
    e.preventDefault();
    const k = +b.dataset.k!;
    const n = shiftKey(k, step);
    if (keyYear(n) < MIN_YEAR || keyYear(n) > MAX_YEAR) return;
    focusPending.current = true;
    setFocusKey(n);
    if (start !== null && end === null) setHover(n);
    if (keyMonth(n) !== m || keyYear(n) !== y) goto(keyYear(n) * 12 + keyMonth(n), n > k ? 1 : -1);
  }

  const complete = start !== null;
  const days = start !== null && end !== null ? daysInclusive(start, end) : 0;

  return (
    <div ref={rootRef} className="ux u030">
      <div className="u030-pills">
        <div className={`u030-pill${start === null || end !== null ? " on" : ""}`}>
          <small>{t("inventory.history.filter.from")}</small>
          <b className={`u030-a${start === null ? " ph" : ""}`}>{start !== null ? pillLabel(start) : t("inventory.history.range.pick")}</b>
        </div>
        <div className={`u030-pill${start !== null && end === null ? " on" : ""}`}>
          <small>{t("inventory.history.filter.to")}</small>
          <b className={`u030-b${end === null ? " ph" : ""}`}>{end !== null ? pillLabel(end) : t("inventory.history.range.pick")}</b>
        </div>
      </div>
      <div className="u030-top">
        <div className="u030-m" aria-live="polite">
          {views.map((v) => (
            <Slide key={v.id} as="span" axis="Y" view={v}>
              {format.monthTitle(new Date(Date.UTC(Math.floor(v.ym / 12), v.ym % 12, 1)))}
            </Slide>
          ))}
        </div>
        <div className="u030-nav">
          <button type="button" aria-label={t("inventory.history.range.prev")} onClick={() => goto(cur.ym - 1, -1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" />
            </svg>
          </button>
          <button type="button" aria-label={t("inventory.history.range.next")} onClick={() => goto(cur.ym + 1, 1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="u030-wk" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div
        className="u030-view"
        onKeyDown={onKeyDown}
        onPointerOver={(e) => {
          const b = (e.target as HTMLElement).closest<HTMLElement>(".u030-d");
          if (b && start !== null && end === null) setHover(+b.dataset.k!);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {views.map((v) => (
          <Slide key={v.id} className={`u030-grid${v.out ? " is-out" : ""}`} axis="X" view={v} role="grid" aria-hidden={v.out || undefined}>
            {monthCells(Math.floor(v.ym / 12), v.ym % 12).map((d, i) => {
              if (d === null) return <div key={i} className="u030-cell" role="gridcell" />;
              const k = toKey(Math.floor(v.ym / 12), v.ym % 12, d);
              const isS = lo !== null && k === (top === null ? start : lo);
              const isE = top !== null && k === top;
              const inRange = lo !== null && top !== null && k >= lo && k <= top;
              const cls = ["u030-cell", isS && "s", isE && "e", inRange && "in"].filter(Boolean).join(" ");
              return (
                <div key={i} className={cls} role="gridcell">
                  <button
                    type="button"
                    className={`u030-d${k === init.todayKey ? " today" : ""}`}
                    data-k={k}
                    tabIndex={!v.out && k === rovingKey ? 0 : -1}
                    aria-label={fmts.full.format(dateOf(k))}
                    aria-pressed={k === start || k === end}
                    onClick={() => pick(k)}
                  >
                    {d}
                  </button>
                </div>
              );
            })}
          </Slide>
        ))}
      </div>
      <div className="u030-foot">
        <span className="u030-sum" aria-live="polite">
          {start !== null && end !== null ? (
            <>
              <b>{t("inventory.history.range.days", { count: days })}</b> · {format.date(keyToYmd(start))} – {format.date(keyToYmd(end))}
            </>
          ) : start !== null ? (
            t("inventory.history.range.pickEnd")
          ) : (
            t("inventory.history.range.pickStart")
          )}
        </span>
        <button
          className="u030-ok"
          type="button"
          aria-disabled={!complete}
          onClick={() => {
            if (start !== null) onApply(keyToYmd(start), end !== null ? keyToYmd(end) : null);
          }}
        >
          {t("inventory.history.range.apply")}
        </button>
      </div>
    </div>
  );
}

// 달 하나의 날짜판·제목. 들어올 때는 방향 쪽에서 미끄러져 오고 나갈 때는 반대쪽으로 사라진다(원본의 translate+opacity 전환)
function Slide({
  as: Tag = "div",
  axis,
  view,
  className,
  children,
  ...rest
}: {
  as?: "div" | "span";
  axis: "X" | "Y";
  view: View;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(!view.enter);
  // 시작 위치를 먼저 그리게 레이아웃을 한 번 확정한 뒤 제자리로 보낸다
  useEffect(() => {
    if (entered) return;
    void ref.current?.offsetWidth;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);
  const shift = !entered ? view.dir * 100 : view.out ? -view.dir * 100 : 0;
  const style: React.CSSProperties = shift ? { transform: `translate${axis}(${shift}%)`, opacity: 0 } : { transform: "none", opacity: 1 };
  const Comp = Tag as "div";
  return (
    <Comp ref={ref as React.Ref<HTMLDivElement>} className={className} style={style} {...rest}>
      {children}
    </Comp>
  );
}
