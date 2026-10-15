"use client";
// 루트 레이아웃까지 실패했을 때의 오류 화면. 자체 html·body와 전역 스타일을 직접 가진다
import "./globals.css";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body>
        <title>문제가 발생했습니다</title>
        <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-(length:--fs-xl) font-semibold text-(--text)">문제가 발생했습니다.</h1>
          <p className="text-(length:--fs-base) text-(--text-3)">
            잠시 후 다시 시도해 주세요.{error.digest ? ` 오류 코드 ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-(--h-md) rounded-(--r-sm) bg-(--accent) px-3 text-(length:--fs-sm) font-medium text-(--on-accent) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
