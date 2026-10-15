// 라우트 골격 화면. 페이지 머리말과 "다음 단계에서 구현" 안내를 보인다. 실제 기능은 P3 이후에 채운다
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export function StubPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        icon={Construction}
        title="다음 단계에서 구현됩니다"
        description="이 화면의 기능은 아직 준비 중입니다. 경로와 화면 구성만 먼저 열어 두었습니다."
      />
    </>
  );
}
