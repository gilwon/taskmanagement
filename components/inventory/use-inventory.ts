"use client";
// 재고 Server Action 호출 훅. 실패는 toast.error, 성공은 toast.success와 router.refresh로 처리하고 중복 제출을 막는다
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import type { ActionResult } from "@/lib/tasks/types";

export function useInventory() {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // state는 다음 렌더에야 바뀌므로 같은 틱의 중복 호출은 ref로 막는다
  const busy = useRef(false);

  const run = useCallback(
    async <R>(call: () => Promise<ActionResult<R>>, successMessage: string): Promise<ActionResult<R>> => {
      if (busy.current) return { ok: false, error: "" };
      busy.current = true;
      setPending(true);
      try {
        // 서버 액션이 throw하면(네트워크 끊김 등) 연결 실패 문구로 바꾼다
        const r = await call().catch((): ActionResult<R> => ({ ok: false, error: t("tasks.errors.network") }));
        if (r.ok) {
          toast.success(successMessage);
          router.refresh();
        } else toast.error(r.error);
        return r;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [router, t],
  );

  return { run, pending };
}
