"use client";
// 환경설정 provider. localStorage 값을 읽어 html data-* 속성에 반영하고 변경 함수를 내려 준다
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFS,
  REDUCED_MOTION_QUERY,
  applyPrefs,
  readPrefs,
  writePrefs,
  type Prefs,
} from "@/lib/prefs/prefs";

// 같은 탭 변경과 다른 탭(storage 이벤트) 변경을 함께 구독하는 작은 저장소
let current: Prefs | null = null;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (!current) current = readPrefs();
  return current;
}
// 서버 렌더와 hydration은 기본값으로 맞추고, 실제 화면은 인라인 스크립트가 심은 속성이 맡는다
function getServerSnapshot() {
  return DEFAULT_PREFS;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => {
    current = readPrefs();
    applyPrefs(current);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

type PrefsContextValue = {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 첫 반영은 인라인 스크립트가 했다. 다만 404처럼 React가 html을 클라이언트에서 다시 그리면 서버 기본값으로
  // 돌아가므로 마운트 때 저장값을 한 번 더 심는다(서버 스냅숏이 아니라 저장값이라 깜빡임이 없다). OS 설정 변경도 다시 심는다
  useEffect(() => {
    applyPrefs(getSnapshot());
    const mq = matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => applyPrefs(getSnapshot());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPref = useCallback<PrefsContextValue["setPref"]>((key, value) => {
    current = { ...getSnapshot(), [key]: value };
    writePrefs(current);
    applyPrefs(current);
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo(() => ({ prefs, setPref }), [prefs, setPref]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs는 PrefsProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
