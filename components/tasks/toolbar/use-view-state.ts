"use client";
// 뷰 상태 훅. 화면에는 즉시 반영하고, DB 저장(user_view_states)은 300ms 디바운스로 한다. 떠날 때 남은 저장은 바로 보낸다
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { saveViewState } from "@/lib/tasks/actions";
import type { ViewKey, ViewState } from "@/lib/tasks/types";

const DELAY = 300;

export function useViewState(workspaceId: string, viewKey: ViewKey, initial: ViewState) {
  const t = useT();
  const [state, setState] = useState(initial);
  // 뷰 키가 바뀌면 그 뷰의 저장값으로 다시 시작한다
  const [prevKey, setPrevKey] = useState(`${workspaceId}/${viewKey}`);
  if (prevKey !== `${workspaceId}/${viewKey}`) {
    setPrevKey(`${workspaceId}/${viewKey}`);
    setState(initial);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);

  const update = useCallback(
    (next: ViewState) => {
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      pending.current = () => {
        void saveViewState(workspaceId, viewKey, next).then((r) => {
          if (!r.ok) toast.error(t("tasks.toolbar.viewSaveFailed", { error: r.error }));
        });
      };
      timer.current = setTimeout(flush, DELAY);
    },
    [workspaceId, viewKey, flush, t],
  );

  // 화면을 떠나거나 뷰가 바뀌면 남은 저장을 보낸다
  useEffect(() => flush, [workspaceId, viewKey, flush]);

  return [state, update] as const;
}
