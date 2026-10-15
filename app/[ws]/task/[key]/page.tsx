// 작업 단독 화면 골격. 키(WEB-112)로 워크스페이스 안의 작업을 찾고 없으면 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/shell/stub-page";
import { getTask } from "@/lib/data/workspace";

type Params = Promise<{ ws: string; key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, key } = await params;
  const task = await getTask(ws, key);
  return task ? { title: `${task.key} ${task.title}` } : {};
}

export default async function TaskPage({ params }: { params: Params }) {
  const { ws, key } = await params;
  const task = await getTask(ws, key);
  if (!task) notFound();
  return <StubPage title={task.title} subtitle={task.key} />;
}
