// 설정 레이아웃. 왼쪽 섹션 내비게이션과 오른쪽 섹션 본문. 900px 이하에서는 내비게이션이 위로 가는 1열이다
import { SettingsNav } from "@/components/org/settings-nav";
import { getMember, requireUserId } from "@/lib/data/workspace";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ ws: string }>;
}) {
  const { ws } = await params;
  // 게스트에게 403으로 가는 섹션 링크를 숨기려고 내 역할을 넘긴다. 실제 차단은 섹션 페이지가 한다
  const me = await getMember(ws, await requireUserId());
  return (
    <div className="grid gap-(--s-6) px-(--gutter) pt-(--s-6) pb-(--s-8) min-[901px]:grid-cols-[200px_minmax(0,1fr)]">
      <SettingsNav wsSlug={ws} role={me?.role ?? null} />
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}
