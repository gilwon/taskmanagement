"use client";
// 워크스페이스 안 오류 경계. 셸은 그대로 두고 본문에만 오류 안내와 다시 시도 버튼을 보인다
import { useEffect } from "react";
import { ErrorState } from "@/components/shell/error-state";
import { useT } from "@/lib/i18n/client";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-(--s-12)">
      <ErrorState
        description={error.digest ? t("errors.retryWithCode", { code: error.digest }) : undefined}
        onRetry={() => retry()}
      />
    </div>
  );
}
