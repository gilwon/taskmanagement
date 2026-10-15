// 워크스페이스 안에서 없는 프로젝트·작업·구성원 등을 찾았을 때 셸 안에 보이는 404
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/empty-state";

export default function WorkspaceNotFound() {
  return (
    <div className="pt-(--s-12)">
      <h1 className="sr-only">페이지를 찾을 수 없습니다</h1>
      <EmptyState
        icon={SearchX}
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
