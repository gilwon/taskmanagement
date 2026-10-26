"use client";
// 수량 입력 + 굴러가는 −/＋ 스테퍼(Lucian #018). 직접 입력은 그대로 두고 버튼으로 바뀔 때만 숫자를 굴린다
// Lucian UX/UI Prompt #018 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#018
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import type { QtyResult } from "@/lib/inventory/rules";
import "./lucian-stepper.css";

type Props = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  // 입력 문자열 해석. 대화상자의 parseQty/parseTarget을 그대로 받는다
  parse: (input: string) => QtyResult;
  // 0을 허용하면 최소 0, 아니면 0 초과라 정수 단위로는 1
  allowZero: boolean;
  // 올릴 수 있는 상한(출발 위치 수량). 없으면 제한 없음
  max?: number;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const ROW = 34;

export function QtyStepper({ id, value, onChange, parse, allowZero, max, autoFocus, ...aria }: Props) {
  const t = useT();
  const stepRef = useRef<HTMLDivElement>(null);
  // 버튼으로 바뀐 값을 굴림 숫자로 보이는 중인지. 타이핑을 시작하면 끈다
  const [rolled, setRolled] = useState(false);

  const parsed = parse(value);
  const cur = parsed.ok ? parsed.value : 0;
  const min = allowZero ? 0 : 1;
  const atMin = Math.round(cur) <= min;
  const atMax = max !== undefined && cur >= max;

  const shake = () => {
    const el = stepRef.current;
    if (!el) return;
    el.classList.remove("is-shake");
    void el.offsetWidth; // 같은 애니메이션을 다시 재생하려고 리플로를 일으킨다
    el.classList.add("is-shake");
  };

  const bump = (d: 1 | -1) => {
    const n = Math.round(cur) + d;
    if ((d < 0 && n < min) || (d > 0 && max !== undefined && n > max)) return shake();
    onChange(String(n));
    setRolled(true);
  };

  return (
    <div className="ux u018">
      <div ref={stepRef} className="u018-step" onAnimationEnd={(e) => e.currentTarget.classList.remove("is-shake")}>
        <button type="button" className="u018-b" aria-label={t("inventory.movement.qtyDecrease")} aria-disabled={atMin} onClick={() => bump(-1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" /></svg>
        </button>
        <div className={rolled ? "u018-field is-rolling" : "u018-field"}>
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setRolled(false);
              onChange(e.target.value);
            }}
            className="h-[34px] border-0 bg-transparent px-0 text-center text-[26px] leading-[34px] font-[780] tracking-[-.02em] tabular-nums focus-visible:ring-0 aria-invalid:ring-0 md:text-[26px] dark:bg-transparent dark:aria-invalid:ring-0"
            {...aria}
          />
          {/* 항상 그려 두어야 첫 버튼 누름부터 이전 숫자에서 굴러간다. 굴리는 중이 아니면 CSS가 숨긴다 */}
          <span className="u018-num" aria-hidden="true">
              {/* 자리마다 0~9를 세로로 쌓고 숫자만큼 위로 올려 보인다. 자리 키는 오른쪽 기준이라 자릿수가 바뀌어도 남은 자리는 이어서 굴러간다 */}
              {[...value].map((ch, i) =>
                /\d/.test(ch) ? (
                  <span key={value.length - i} className="u018-col" style={{ transform: `translateY(${-Number(ch) * ROW}px)` }}>
                    {Array.from({ length: 10 }, (_, d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </span>
                ) : (
                  <span key={value.length - i} className="u018-col"><span>{ch}</span></span>
                ),
              )}
          </span>
          <span className="u018-sr" aria-live="polite" aria-atomic="true">{rolled ? value : ""}</span>
        </div>
        <button type="button" className="u018-b pl" aria-label={t("inventory.movement.qtyIncrease")} aria-disabled={atMax} onClick={() => bump(1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
        </button>
      </div>
    </div>
  );
}
