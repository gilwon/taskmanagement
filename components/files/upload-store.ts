"use client";
// 이 탭에서 진행 중이거나 끝난 업로드 상태 저장소(파일 id 키). 모듈 수준이라 드로어를 닫았다 열어도 진행률·결과가 이어진다.
// 원본 File(재시도용)과 XHR(취소용)도 여기에 둔다
import { useSyncExternalStore } from "react";

// error가 있으면 실패·취소, done이면 ready까지 끝남. 그 밖에는 진행 중(pct 100은 완료 확인 대기)
export type Transfer = { pct: number; error?: string; canceled?: boolean; done?: boolean };

type Snapshot = Readonly<Record<string, Transfer>>;

let snapshot: Snapshot = {};
const EMPTY: Snapshot = {};
const listeners = new Set<() => void>();

export const uploadBlobs = new Map<string, File>();
export const uploadXhrs = new Map<string, XMLHttpRequest>();

export function setTransfer(id: string, t: Transfer | null) {
  const next = { ...snapshot };
  if (t) next[id] = t;
  else delete next[id];
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTransfers(): Snapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}
