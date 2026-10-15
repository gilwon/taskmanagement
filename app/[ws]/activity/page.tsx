// 활동 화면. 워크스페이스에서 일어난 변경 기록을 종류·사람으로 거르고 날짜별로 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityPageBody, type ActivitySearch } from "@/components/activity/activity-page";
import { PageHeader } from "@/components/shell/page-header";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: NAV_LABELS.activity };

type Props = { params: Promise<{ ws: string }>; searchParams: Promise<ActivitySearch> };

export default async function ActivityPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  return (
    <>
      <PageHeader title={NAV_LABELS.activity} subtitle="워크스페이스에서 일어난 변경 기록을 봅니다." />
      <ActivityPageBody workspace={workspace} userId={userId} projectId={null} query={query} />
    </>
  );
}
