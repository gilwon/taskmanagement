// 라우트 골격 화면. 페이지 머리말과 "다음 단계에서 구현" 안내를 보인다. 실제 기능은 P3 이후에 채운다
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { getT } from "@/lib/i18n/server";

export async function StubPage({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = await getT();
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        icon={Construction}
        title={t("shell.stub.title")}
        description={t("shell.stub.description")}
      />
    </>
  );
}
