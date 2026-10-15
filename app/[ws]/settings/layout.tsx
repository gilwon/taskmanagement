// 설정 레이아웃. 왼쪽 섹션 내비게이션과 오른쪽 섹션 본문. 900px 이하에서는 내비게이션이 위로 가는 1열이다
import { SettingsNav } from "@/components/org/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ ws: string }>;
}) {
  const { ws } = await params;
  return (
    <div className="grid gap-(--s-6) px-(--gutter) pt-(--s-6) pb-(--s-8) min-[901px]:grid-cols-[200px_minmax(0,1fr)]">
      <SettingsNav wsSlug={ws} />
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}
