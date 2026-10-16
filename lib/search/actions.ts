"use server";
// 검색 서버 액션. 커맨드 팔레트·검색 화면이 부르는 검색과 사용자별 최근 검색어(user_prefs.recent_searches) 읽기·저장
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { SearchError, searchWorkspace } from "@/lib/search/queries";
import { normalizeQuery } from "@/lib/search/text";
import { isSearchScope, type SearchResults, type SearchScope } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { ActionResult } from "@/lib/tasks/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_MAX = 8;

type Client = Awaited<ReturnType<typeof createClient>>;

// 세션의 사용자 id. 없으면 null
async function sessionUser(supabase: Client): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

async function readRecent(supabase: Client, workspaceId: string, t: T): Promise<ActionResult<string[]>> {
  const { data, error } = await supabase
    .from("user_prefs")
    .select("recent_searches")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    console.error("[최근 검색]", error.code, error.message);
    return { ok: false, error: taskErrorMessage(error, t) };
  }
  // 행이 아직 없으면 빈 목록
  return { ok: true, data: data?.recent_searches ?? [] };
}

export async function searchWorkspaceAction(
  workspaceId: string,
  q: string,
  scope: SearchScope,
  limit?: number,
): Promise<ActionResult<SearchResults>> {
  const t = await getT();
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId) || !isSearchScope(scope)) {
    return { ok: false, error: t("errors.rpc.invalidInput") };
  }
  if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit))) return { ok: false, error: t("errors.rpc.invalidInput") };
  try {
    const supabase = await createClient();
    if (!(await sessionUser(supabase))) return { ok: false, error: t("errors.msg.sessionExpired") };
    return { ok: true, data: await searchWorkspace(workspaceId, normalizeQuery(q), scope, limit) };
  } catch (e) {
    // fail()이 만든 SearchError만 화면용 문구다. 그 밖의 예외 원문은 보이지 않는다
    console.error("[검색]", e);
    return {
      ok: false,
      error: e instanceof SearchError ? e.message : taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t),
    };
  }
}

export async function getRecentSearches(workspaceId: string): Promise<ActionResult<string[]>> {
  const t = await getT();
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) return { ok: false, error: t("errors.rpc.invalidInput") };
  try {
    const supabase = await createClient();
    if (!(await sessionUser(supabase))) return { ok: false, error: t("errors.msg.sessionExpired") };
    return await readRecent(supabase, workspaceId, t);
  } catch (e) {
    console.error("[최근 검색]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t) };
  }
}

// 대소문자 무시로 같은 검색어를 지우고 맨 앞에 넣어 최대 8개를 남긴다.
// upsert는 넘긴 컬럼만 갱신하므로 같은 행의 proj_order 등은 그대로 남는다
export async function saveRecentSearch(workspaceId: string, q: string): Promise<ActionResult<string[]>> {
  const t = await getT();
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) return { ok: false, error: t("errors.rpc.invalidInput") };
  try {
    const supabase = await createClient();
    const sub = await sessionUser(supabase);
    if (!sub) return { ok: false, error: t("errors.msg.sessionExpired") };
    const current = await readRecent(supabase, workspaceId, t);
    const query = normalizeQuery(q);
    if (!current.ok || !query) return current;
    const lower = query.toLowerCase();
    const recent_searches = [query, ...current.data.filter((s) => s.toLowerCase() !== lower)].slice(0, RECENT_MAX);
    const { error } = await supabase
      .from("user_prefs")
      .upsert({ user_id: sub, workspace_id: workspaceId, recent_searches }, { onConflict: "user_id,workspace_id" });
    if (error) {
      console.error("[최근 검색 저장]", error.code, error.message);
      return { ok: false, error: taskErrorMessage(error, t) };
    }
    return { ok: true, data: recent_searches };
  } catch (e) {
    console.error("[최근 검색 저장]", e);
    return { ok: false, error: taskErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t) };
  }
}
