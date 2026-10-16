"use client";
// #064 봉투 그림. 첫 진입 때 편지가 봉투로 들어가고 덮개가 닫힌 뒤 확인 배지가 튀어나온다
import { useEffect, useRef } from "react";
import { motionOff } from "@/lib/prefs/prefs";

export function Envelope() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (motionOff()) {
      el.classList.add("sealed", "sent");
      return;
    }
    // 첫 화면이 그려진 뒤에 클래스를 붙여야 전환이 돈다
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      el.classList.add("sealed");
      timer = window.setTimeout(() => el.classList.add("sent"), 950);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className="u064" aria-hidden="true">
      <div className="u064-art">
        <div className="u064-env">
          <span className="u064-clip">
            <span className="u064-back" />
            <span className="u064-letter">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="u064-front" />
          <span className="u064-flap" />
          <span className="u064-badge">
            <svg viewBox="0 0 20 20">
              <path d="M5 10.5l3.5 3.5L15 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
