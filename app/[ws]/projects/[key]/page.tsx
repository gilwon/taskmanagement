// /{ws}/projects/{key}로 들어오면 프로젝트 개요 탭으로 보낸다
import { redirect } from "next/navigation";
import type { ProjectParams } from "@/lib/data/project";

export default async function ProjectIndex({ params }: { params: ProjectParams }) {
  const { ws, key } = await params;
  redirect(`/${ws}/projects/${key}/overview`);
}
