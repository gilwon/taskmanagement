// 캘린더·타임라인용 서버 조회. 일정(events)과 마일스톤을 RLS 세션 클라이언트로 한 번씩 읽는다.
// 작업 의존성(task_deps)은 작업 조회(TaskItem.blockedBy)에 이미 들어 있어 따로 읽지 않는다
import "server-only";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, Milestone } from "@/lib/schedule/types";
import { taskErrorMessage } from "@/lib/tasks/errors";

// 오류는 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
function fail(t: T, what: "events" | "milestones", error: { code?: string; message: string }): never {
  console.error(`[${what}]`, error.code, error.message);
  throw new Error(t("schedule.errors.loadFailed", { what: t(`schedule.load.${what}`), reason: taskErrorMessage(error, t) }));
}

// 기간 안의 일정. 삭제·보관된 프로젝트의 일정은 뺀다. time은 "HH:MM"으로 자른다
export async function getEvents(scope: {
  workspaceId: string;
  projectId?: string;
  from: string;
  to: string;
}): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select("id, title, date, time, project:projects!inner(id, name, color, deleted_at, archived_at)")
    .eq("workspace_id", scope.workspaceId)
    .gte("date", scope.from)
    .lte("date", scope.to)
    .is("project.deleted_at", null)
    .is("project.archived_at", null);
  if (scope.projectId) q = q.eq("project_id", scope.projectId);
  const { data, error } = await q.order("date").order("time", { nullsFirst: true });
  if (error) fail(await getT(), "events", error);
  return data.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time ? e.time.slice(0, 5) : null,
    project: { id: e.project.id, name: e.project.name, color: e.project.color },
  }));
}

// 마일스톤. milestones에는 workspace_id가 없어 프로젝트를 임베드해 워크스페이스로 자른다
export async function getMilestones(scope: { workspaceId: string; projectId?: string }): Promise<Milestone[]> {
  const supabase = await createClient();
  let q = supabase
    .from("milestones")
    .select("id, name, date, project:projects!inner(id, name, color, workspace_id, deleted_at, archived_at)")
    .eq("project.workspace_id", scope.workspaceId)
    .is("project.deleted_at", null)
    .is("project.archived_at", null);
  if (scope.projectId) q = q.eq("project_id", scope.projectId);
  const { data, error } = await q.order("date");
  if (error) fail(await getT(), "milestones", error);
  return data.map((m) => ({
    id: m.id,
    name: m.name,
    date: m.date,
    project: { id: m.project.id, name: m.project.name, color: m.project.color },
  }));
}
