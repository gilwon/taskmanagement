"use client";
// 앱 오류 경계. 렌더 중 예외를 현재 로캘 안내와 다시 시도 버튼으로 보인다
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shell/error-state";
import { useT } from "@/lib/i18n/client";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col justify-center">
      <ErrorState
        description={error.digest ? t("errors.retryWithCode", { code: error.digest }) : undefined}
        action={
          <Button size="sm" onClick={() => retry()}>
            {t("common.action.retry")}
          </Button>
        }
      />
    </main>
  );
}
