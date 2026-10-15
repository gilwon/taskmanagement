"use client";
// 전역 단축키 리스너. document keydown 하나로 받아 matchShortcut 결과를 handlers로 넘기고, g 다음 키 이동을 처리한다
import { useEffect, useRef } from "react";
import {
  GO_TARGETS,
  GO_WINDOW_MS,
  isInOverlay,
  isTypingTarget,
  matchGoTarget,
  matchShortcut,
  type ShortcutAction,
} from "@/components/shortcuts/keys";

export type ShortcutHandlers = Record<Exclude<ShortcutAction, "go">, () => void> & {
  go: (path: (typeof GO_TARGETS)[keyof typeof GO_TARGETS]) => void;
};

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    // g를 누른 시각. 0이면 기다리는 중이 아니다
    let goAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const active = document.activeElement;
      const focus = { typing: isTypingTarget(active), overlay: isInOverlay(active) };

      if (goAt) {
        const within = Date.now() - goAt <= GO_WINDOW_MS;
        // Shift·Ctrl 같은 조합 키만 누른 입력은 기다림을 끊지 않는다
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        goAt = 0;
        const code = within && !focus.typing && !focus.overlay ? matchGoTarget(e) : null;
        if (code) {
          e.preventDefault();
          ref.current.go(GO_TARGETS[code]);
          return;
        }
      }

      const action = matchShortcut(e, focus);
      if (!action) return;
      e.preventDefault();
      if (action === "go") goAt = Date.now();
      else ref.current[action]();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
