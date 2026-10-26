"use client";
// 워크스페이스 환경 설정(작업 여는 방식·삭제 전 확인)을 서버 값으로 내려 주는 context. 레이아웃이 감싼다
import { createContext, useContext } from "react";
import { DEFAULT_USER_PREFS, type UserPrefsView } from "@/lib/org/rules";

const Ctx = createContext<UserPrefsView>(DEFAULT_USER_PREFS);

export function WorkspacePrefsProvider({ value, children }: { value: UserPrefsView; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWorkspacePrefs = () => useContext(Ctx);
