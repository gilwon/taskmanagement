"use client";
// 앱 전체 404. 없는 경로와 소속이 아닌 워크스페이스 slug가 여기로 온다
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/components/shell/use-document-title";

const TITLE = "페이지를 찾을 수 없습니다";

export default function NotFound() {
  // 없는 경로는 루트 metadata의 "작업 공간" title이 head에서 아래 title보다 앞에 와 문서 제목을 차지해 다시 맞춘다
  // Next 16의 global-not-found는 experimental 설정이 필요해 [ws]/not-found와 같은 관찰자 방식을 쓴다
  useDocumentTitle(TITLE);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-(--gutter) py-(--s-12) text-center">
      {/* not-found에는 metadata를 둘 수 없어 React의 title 끌어올리기로 문서 제목을 정한다 */}
      <title>{TITLE}</title>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-(--surface-2) text-(--text-3)">
        <SearchX aria-hidden size={18} strokeWidth={1.8} />
      </span>
      <h1 className="text-(length:--fs-xl) font-semibold text-(--text)">페이지를 찾을 수 없습니다</h1>
      <p className="max-w-md text-(length:--fs-base) text-(--text-3)">
        주소가 바뀌었거나 삭제되었거나, 볼 권한이 없는 워크스페이스입니다.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">홈으로</Link>
      </Button>
    </main>
  );
}
