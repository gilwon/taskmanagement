"use client";
// 지금 화면의 뷰 상태를 프로젝트 헤더의 "저장 뷰 만들기"와 나누는 context. 프로젝트 작업 화면에서만 채워진다
import { createContext, useContext, useRef } from "react";
import type { ViewState } from "@/lib/tasks/types";

const CurrentViewContext = createContext<React.RefObject<ViewState | null> | null>(null);

export function CurrentViewProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<ViewState | null>(null);
  return <CurrentViewContext.Provider value={ref}>{children}</CurrentViewContext.Provider>;
}

// Provider 밖(개요 등 골격 탭)에서는 null
export function useCurrentView() {
  return useContext(CurrentViewContext);
}
