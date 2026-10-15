"use server";
// 드로어 전용 Server Action. 키로 작업 읽기, 작업 즐겨찾기, 선행 작업 검색. 범위는 RLS가 자르고 오류는 한국어 결과로 돌려준다
import { MSG } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { getTaskItemByKey } from "@/lib/tasks/queries";
import type { ActionResult, TaskItem, TaskStatus } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "입력값을 다시 확인해 주세요.";

async function uid() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return sub ? { supabase, sub } : null;
}

// 목록 store에 없는 작업(다른 화면에서 키로 진입)을 읽는다. 조회 오류는 throw되므로 잡아서 문구로 바꾼다
export async function fetchTaskByKey(workspaceId: string, key: string): Promise<ActionResult<TaskItem | null>> {
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId) || typeof key !== "string") {
    return { ok: false, error: INVALID };
  }
  try {
    return { ok: true, data: await getTaskItemByKey(workspaceId, key) };
  } catch (e) {
    console.error("[작업 읽기]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }) };
  }
}

export async function getTaskFavorite(taskId: string): Promise<ActionResult<boolean>> {
  if (typeof taskId !== "string" || !UUID_RE.test(taskId)) return { ok: false, error: INVALID };
  const s = await uid();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { data, error } = await s.supabase
    .from("favorites")
    .select("task_id")
    .eq("user_id", s.sub)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) {
    console.error("[즐겨찾기 읽기]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  return { ok: true, data: !!data };
}

// favorites_owner 정책이 본인 행·소속 워크스페이스만 허용한다
export async function setTaskFavorite(workspaceId: string, taskId: string, on: boolean): Promise<ActionResult<boolean>> {
  if (![workspaceId, taskId].every((v) => typeof v === "string" && UUID_RE.test(v)) || typeof on !== "boolean") {
    return { ok: false, error: INVALID };
  }
  const s = await uid();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  const { error } = on
    ? await s.supabase.from("favorites").insert({ user_id: s.sub, workspace_id: workspaceId, task_id: taskId })
    : await s.supabase.from("favorites").delete().eq("user_id", s.sub).eq("task_id", taskId);
  // 이미 즐겨찾기한 작업은 성공으로 본다
  if (error && error.code !== "23505") {
    console.error("[즐겨찾기 저장]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  return { ok: true, data: on };
}

export type TaskHit = { id: string; key: string; title: string; status: TaskStatus };

// 선행 작업 후보. 키(WEB-112) 또는 제목 일부로 찾는다. 삭제된 작업은 뺀다
export async function searchWorkspaceTasks(workspaceId: string, q: string): Promise<ActionResult<TaskHit[]>> {
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId) || typeof q !== "string" || q.length > 200) {
    return { ok: false, error: INVALID };
  }
  const s = await uid();
  if (!s) return { ok: false, error: MSG.sessionExpired };
  // PostgREST or 필터 문법을 깨는 문자는 공백으로 바꾼다
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  let query = s.supabase
    .from("tasks")
    .select("id, key, title, status")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (term) query = query.or(`title.ilike.*${term}*,key.ilike.*${term}*`);
  const { data, error } = await query;
  if (error) {
    console.error("[작업 검색]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error) };
  }
  return { ok: true, data };
}
