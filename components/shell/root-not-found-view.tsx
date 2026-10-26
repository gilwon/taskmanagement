"use client";
// 앱 전체 404의 화면 부분. 서버 not-found가 고른 제안 줄을 받아 카드와 문서 제목을 그린다
import { NotFoundCard, type NotFoundCandidate } from "@/components/shell/not-found-card";
import { useDocumentTitle } from "@/components/shell/use-document-title";

export function RootNotFoundView({
  title,
  description,
  candidates,
  similar,
}: {
  title: string;
  description: string;
  candidates: NotFoundCandidate[];
  similar: boolean;
}) {
  // 없는 경로는 루트 metadata의 "작업 공간" title이 head에서 아래 title보다 앞에 와 문서 제목을 차지해 다시 맞춘다
  // Next 16의 global-not-found는 experimental 설정이 필요해 [ws]/not-found와 같은 관찰자 방식을 쓴다
  useDocumentTitle(title);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-(--gutter) py-(--s-12) text-center">
      {/* not-found에는 metadata를 둘 수 없어 React의 title 끌어올리기로 문서 제목을 정한다 */}
      <title>{title}</title>
      <NotFoundCard title={title} description={description} candidates={candidates} similar={similar} />
    </main>
  );
}
