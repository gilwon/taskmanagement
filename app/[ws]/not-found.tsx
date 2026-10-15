"use client";
// 워크스페이스 안에서 없는 프로젝트·작업·구성원 등을 찾았을 때 셸 안에 보이는 404
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceName } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/shell/empty-state";
import { useDocumentTitle } from "@/components/shell/use-document-title";

export default function WorkspaceNotFound() {
  const workspaceName = useWorkspaceName();
  const title = workspaceName ? `페이지를 찾을 수 없습니다 · ${workspaceName}` : "페이지를 찾을 수 없습니다";
  // 클라이언트 이동에서는 레이아웃 metadata의 title이 이 효과 뒤에 앞자리로 들어와 head가 바뀔 때마다 다시 맞춘다
  // Next 16 문서상 metadata는 global-not-found만 지원하고(이 404는 notFound()로 오는 세그먼트 404라 해당 없음) 대안은 React title뿐이라 관찰자가 필요하다
  useDocumentTitle(title);
  return (
    <div className="pt-(--s-12)">
      {/* not-found에는 metadata를 둘 수 없어 React의 title 끌어올리기로 문서 제목을 정한다 */}
      <title>{title}</title>
      <EmptyState
        icon={SearchX}
        titleAs="h1"
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나 삭제되었거나, 볼 권한이 없는 항목입니다."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">홈으로</Link>
          </Button>
        }
      />
    </div>
  );
}
