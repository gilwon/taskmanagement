"use client";
// 태스크 드로어 열림 상태를 URL 검색 파라미터 ?task={KEY}로 관리한다. 새로고침·뒤로가기·링크 공유에서 유지된다
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useWorkspacePrefs } from "@/components/org/workspace-prefs";

const PARAM = "task";
const KEY_RE = /^[A-Z][A-Z0-9]{0,9}-\d+$/;

export function useTaskDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { ws } = useParams<{ ws?: string }>();
  const { taskOpen } = useWorkspacePrefs();
  const raw = params.get(PARAM);
  // 형식이 틀린 값은 닫힌 것으로 본다
  const openKey = raw && KEY_RE.test(raw) ? raw : null;

  const hrefWith = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (key) next.set(PARAM, key);
      else next.delete(PARAM);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  // 열기는 기록을 남겨 뒤로가기로 닫히게 하고, 닫기는 현재 기록을 바꿔 뒤로가기가 다시 열지 않게 한다
  const openPanel = useCallback(
    (key: string) => router.push(hrefWith(key), { scroll: false }),
    [router, hrefWith],
  );
  // 환경 설정이 "전체 페이지"이면 /{ws}/task/{key}로 간다. 이미 열린 패널 안의 이전·다음 이동은 openPanel을 쓴다
  const open = useCallback(
    (key: string) => (taskOpen === "page" && ws ? router.push(`/${ws}/task/${key}`) : openPanel(key)),
    [taskOpen, ws, router, openPanel],
  );
  const close = useCallback(() => router.replace(hrefWith(null), { scroll: false }), [router, hrefWith]);

  return { openKey, open, openPanel, close };
}
