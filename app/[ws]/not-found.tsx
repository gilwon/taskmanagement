"use client";
// 워크스페이스 안에서 없는 프로젝트·작업·구성원 등을 찾았을 때 셸 안에 보이는 404
import { useParams } from "next/navigation";
import { useWorkspaceName } from "@/components/shell/app-shell";
import { NotFoundCard } from "@/components/shell/not-found-card";
import { useDocumentTitle } from "@/components/shell/use-document-title";
import { useT } from "@/lib/i18n/client";

export default function WorkspaceNotFound() {
  const t = useT();
  const workspaceName = useWorkspaceName();
  const { ws } = useParams<{ ws: string }>();
  const title = workspaceName ? t("errors.notFound.titleIn", { workspace: workspaceName }) : t("errors.notFound.title");
  // 클라이언트 이동에서는 레이아웃 metadata의 title이 이 효과 뒤에 앞자리로 들어와 head가 바뀔 때마다 다시 맞춘다
  // Next 16 문서상 metadata는 global-not-found만 지원하고(이 404는 notFound()로 오는 세그먼트 404라 해당 없음) 대안은 React title뿐이라 관찰자가 필요하다
  useDocumentTitle(title);
  return (
    <div className="px-(--gutter) pt-(--s-12)">
      {/* not-found에는 metadata를 둘 수 없어 React의 title 끌어올리기로 문서 제목을 정한다 */}
      <title>{title}</title>
      <NotFoundCard
        similar
        title={t("errors.notFound.title")}
        description={t("errors.notFound.item")}
        candidates={[
          { href: `/${ws}/home`, name: t("common.nav.home") },
          { href: `/${ws}/projects`, name: t("common.nav.projects") },
          { href: `/${ws}/tasks`, name: t("common.nav.tasks") },
          { href: `/${ws}/my-tasks`, name: t("common.nav.myTasks") },
          { href: `/${ws}/inbox`, name: t("common.nav.inbox") },
          { href: `/${ws}/calendar`, name: t("common.nav.calendar") },
          { href: `/${ws}/search`, name: t("common.nav.search") },
          // 워크스페이스 밖으로 나가는 길도 하나 둔다
          { href: "/", name: t("common.action.home") },
        ]}
      />
    </div>
  );
}
