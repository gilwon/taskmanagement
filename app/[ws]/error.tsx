"use client";
// 워크스페이스 안 오류 경계. 셸은 그대로 두고 본문에만 오류 안내와 다시 시도 버튼을 보인다
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shell/error-state";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-(--s-12)">
      <ErrorState
        description={error.digest ? `잠시 후 다시 시도해 주세요. 오류 코드 ${error.digest}` : undefined}
        action={
          <Button size="sm" onClick={() => retry()}>
            다시 시도
          </Button>
        }
      />
    </div>
  );
}
