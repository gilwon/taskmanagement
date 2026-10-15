"use client";
// 앱 오류 경계. 렌더 중 예외를 한국어 안내와 다시 시도 버튼으로 보인다
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shell/error-state";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col justify-center">
      <ErrorState
        description={error.digest ? `잠시 후 다시 시도해 주세요. 오류 코드 ${error.digest}` : undefined}
        action={
          <Button size="sm" onClick={() => retry()}>
            다시 시도
          </Button>
        }
      />
    </main>
  );
}
