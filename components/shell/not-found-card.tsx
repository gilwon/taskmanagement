"use client";
// 404 카드. 나침반이 커서를 따르고, 비슷한 주소를 고르면 주소창이 고쳐진 뒤 그 주소로 이동한다
// Lucian UX/UI Prompt #089 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#089
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useT } from "@/lib/i18n/client";
import { motionOff } from "@/lib/prefs/prefs";
import { cn } from "@/lib/utils";
import "./lucian-notfound.css";

// compare가 있으면 현재 주소의 첫 세그먼트와 compare("/slug" 꼴)를 비교하고, 없으면 현재 주소 전체와 href를 비교한다
export type NotFoundCandidate = { href: string; name: string; compare?: string };

type Phase = "idle" | "fixing" | "found";

const SUGGEST_MAX = 3;
const subscribeNone = () => () => {};

// 두 주소가 얼마나 닮았는지 0~1로 잰다(편집 거리 기준)
function similarity(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1);
}

// 바늘은 스프링으로 움직여서 방향이 크게 바뀌면 살짝 지나쳤다가 돌아온다
function createNeedle(getEl: () => SVGGElement | null) {
  let a = 0;
  let v = 0;
  let tgt = 0;
  let raf = 0;
  let last = 0;
  function step(now: number) {
    raf = 0;
    const el = getEl();
    if (!el?.isConnected) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    if (motionOff()) {
      a = tgt;
      v = 0;
    } else {
      v += (220 * (tgt - a) - 17 * v) * dt;
      a += v * dt;
    }
    el.style.transform = `rotate(${a.toFixed(2)}deg)`;
    if (Math.abs(v) > 0.05 || Math.abs(tgt - a) > 0.05) raf = requestAnimationFrame(step);
  }
  function kick() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }
  return {
    aim(deg: number) {
      tgt = a + ((((deg - a) % 360) + 540) % 360) - 180;
      kick();
    },
    // 한 바퀴 돌아 북쪽에 멈춘다
    spin() {
      tgt = a - (((a % 360) + 360) % 360) + 720;
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

export function NotFoundCard({
  title,
  description,
  candidates,
  similar = false,
}: {
  title: string;
  description: string;
  // 이동할 수 있는 실제 주소들
  candidates: NotFoundCandidate[];
  // true면 현재 주소와 닮은 순서로 골라 일치도 막대를 보인다
  similar?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const host = useSyncExternalStore(subscribeNone, () => location.host, () => "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState<string | null>(null);
  const [picked, setPicked] = useState(-1);
  const [tracking, setTracking] = useState(false);
  const [swap, setSwap] = useState(false);
  const [foundName, setFoundName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const cpRef = useRef<HTMLSpanElement>(null);
  const ndRef = useRef<SVGGElement>(null);
  const timers = useRef<number[]>([]);
  const needle = useRef<ReturnType<typeof createNeedle>>(null);

  useEffect(() => {
    const pending = timers.current;
    const n = createNeedle(() => ndRef.current);
    needle.current = n;
    return () => {
      pending.forEach(clearTimeout);
      n.dispose();
    };
  }, []);

  const locked = phase !== "idle";
  const found = phase === "found";
  const list = (
    similar
      ? candidates.map((c) => ({ ...c, match: similarity(c.compare === undefined ? pathname : `/${pathname.split("/")[1] ?? ""}`, c.compare ?? c.href) })).sort((x, y) => y.match - x.match) : candidates
  ).slice(0, SUGGEST_MAX) as (NotFoundCandidate & { match?: number })[];

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const toward = (x: number, y: number) => {
    const cp = cpRef.current;
    const root = rootRef.current;
    if (!cp || !root) return;
    const r = cp.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    needle.current?.aim((Math.atan2(dx, -dy) * 180) / Math.PI);
    numRef.current?.style.setProperty("--r", Math.max(-1, Math.min(1, dx / (root.getBoundingClientRect().width / 2))).toFixed(3));
  };
  const release = () => {
    setTracking(false);
    numRef.current?.style.setProperty("--r", "0");
    needle.current?.aim(0);
  };
  const aimAt = (el: HTMLElement) => {
    if (locked) return;
    setTracking(true);
    const r = el.getBoundingClientRect();
    toward(r.left + r.width / 2, r.top + r.height / 2);
  };

  // 오타 글자를 한 자씩 지운 뒤 맞는 주소를 다시 입력하고, 숫자가 굴러 200이 되면 그 주소로 이동한다
  const go = (i: number) => {
    if (locked) return;
    const target = list[i];
    const off = motionOff();
    setPicked(i);
    setPhase("fixing");
    let k = pathname.length;
    const del = () => {
      if (k > 1) {
        setTyped(pathname.slice(0, --k));
        return later(del, off ? 0 : 34);
      }
      let j = 1;
      const type = () => {
        setTyped(target.href.slice(0, ++j));
        if (j < target.href.length) return later(type, off ? 0 : 55);
        setPhase("found");
        setTracking(false);
        numRef.current?.style.setProperty("--r", "0");
        needle.current?.spin();
        setSwap(true);
        later(() => {
          setFoundName(target.name);
          setSwap(false);
        }, off ? 0 : 250);
        // 숫자가 구르는 시간을 두고 이동한다
        later(() => router.push(target.href), off ? 0 : 1400);
      };
      type();
    };
    del();
  };

  return (
    <div
      ref={rootRef}
      className={cn("ux u089 mx-auto", phase === "fixing" && "fixing", found && "found", tracking && "trk", swap && "swap")}
      onPointerMove={(e) => {
        if (locked) return;
        setTracking(true);
        toward(e.clientX, e.clientY);
      }}
      onPointerLeave={() => {
        if (rootRef.current?.contains(document.activeElement)) return;
        release();
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget) && !rootRef.current?.matches(":hover")) release();
      }}
    >
      <div className="u089-url">
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5.6" />
          <path d="M1.6 7h10.8M7 1.4c1.8 1.6 1.8 9.6 0 11.2M7 1.4c-1.8 1.6-1.8 9.6 0 11.2" />
        </svg>
        <span>
          {host}
          <b>{typed ?? pathname}</b>
        </span>
      </div>
      <div ref={numRef} className="u089-num" role="img" aria-label={found ? t("common.notFoundCard.code200") : t("common.notFoundCard.code404")}>
        <span className="u089-d" aria-hidden="true">
          <span className="u089-col" style={{ "--v": found ? 2 : 4 } as CSSProperties}>
            <span>0</span>
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </span>
        </span>
        <span ref={cpRef} className="u089-cp" aria-hidden="true">
          <svg viewBox="0 0 72 72">
            <circle className="u089-ring" cx="36" cy="36" r="30.5" />
            <path className="u089-tk" d="M36 14v3M36 55v3M14 36h3M55 36h3" />
            <g className="u089-wob">
              <g ref={ndRef} className="u089-nd">
                <path d="M36 15.5l5.5 20.5h-11z" fill="var(--ux-danger)" />
                <path d="M36 56.5l-5.5-20.5h11z" fill="var(--ux-ink-3)" />
              </g>
            </g>
            <circle className="u089-hub" cx="36" cy="36" r="3.4" />
          </svg>
        </span>
        <span className="u089-d" aria-hidden="true">
          <span className="u089-col" style={{ "--v": found ? 0 : 4 } as CSSProperties}>
            <span>0</span>
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </span>
        </span>
      </div>
      <h1 className="u089-t" aria-live="polite">
        {foundName ? t("common.notFoundCard.foundTitle") : title}
      </h1>
      <p className="u089-s">{foundName ? t("common.notFoundCard.foundDescription", { name: foundName }) : description}</p>
      {list.length > 0 && (
        <>
          <div className="u089-lab">
            <span>{similar ? t("common.notFoundCard.similar") : t("common.notFoundCard.goTo")}</span>
          </div>
          <ul className="u089-sug">
            {list.map((s, i) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className={cn("u089-row", picked === i && "on")}
                  aria-disabled={locked && picked !== i ? true : undefined}
                  aria-label={
                    s.match === undefined
                      ? t("common.notFoundCard.goLabel", { path: s.href, name: s.name })
                      : t("common.notFoundCard.goLabelMatch", { path: s.href, name: s.name, pct: Math.round(s.match * 100) })
                  }
                  onClick={(e) => {
                    // 새 탭·창으로 여는 클릭은 브라우저에 맡긴다
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    go(i);
                  }}
                  onFocus={(e) => aimAt(e.currentTarget)}
                >
                  <code>{s.href}</code>
                  <small>{s.name}</small>
                  {s.match !== undefined && (
                    <span className="u089-m" aria-hidden="true">
                      <i style={{ "--m": s.match } as CSSProperties} />
                    </span>
                  )}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    {found && picked === i ? <path d="M3.2 8.4l3 3L12.8 4.8" /> : <path d="M3 8h10M9 4l4 4-4 4" />}
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
