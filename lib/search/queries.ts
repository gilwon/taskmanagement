// 워크스페이스 검색 서버 조회. 범위는 RLS가 자르고, 필드별 ilike 쿼리를 나눠 돌린 뒤 id로 합친다
import "server-only";
import { NAMELESS_MEMBER_LABEL, UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import { containsQuery, excerpt, likePattern, normalizeQuery } from "@/lib/search/text";
import { SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX, type SearchResults, type SearchScope } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";
import { taskErrorMessage } from "@/lib/tasks/errors";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };

const EMPTY: SearchResults = { tasks: [], projects: [], people: [], files: [], comments: [] };

// fail()이 만든 화면용 오류. 호출부는 이 오류의 문구만 그대로 보이고 나머지는 일반 문구로 바꾼다
export class SearchError extends Error {}

// 오류는 빈 결과로 바꾸지 않고 호출부로 올린다(spec R22)
function fail(what: string, error: DbError): never {
  console.error(`[검색 ${what}]`, error.code, error.message);
  throw new SearchError(`검색 결과를 불러오지 못했습니다. ${taskErrorMessage(error)}`);
}

// 여러 쿼리 결과를 id로 합쳐 중복을 없앤다. 앞 쿼리 결과의 순서를 먼저 따른다
function mergeById<T>(lists: T[][], idOf: (row: T) => string): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const row of list) if (!byId.has(idOf(row))) byId.set(idOf(row), row);
  return [...byId.values()];
}

function unwrap<T>(what: string, r: { data: T[] | null; error: DbError | null }): T[] {
  if (r.error) fail(what, r.error);
  return r.data ?? [];
}

// .or()에 사용자 입력을 넣지 않는다. PostgREST 구문 문자(, ( ) . :)가 필터를 깨뜨리므로 필드마다 따로 묻는다
async function searchTasks(supabase: Client, ws: string, q: string, limit: number) {
  const base = () =>
    supabase
      .from("tasks")
      .select(
        "id, key, title, status, updated_at, project:projects!tasks_project_id_workspace_id_fkey!inner(key, name, color, icon)",
      )
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("project.deleted_at", null)
      .is("project.archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
  const pattern = likePattern(q);
  const [byTitle, byKey] = await Promise.all([base().ilike("title", pattern), base().ilike("key", pattern)]);
  return mergeById([unwrap("작업", byTitle), unwrap("작업", byKey)], (t) => t.id)
    .filter((t) => containsQuery(t.title, q) || containsQuery(t.key, q))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
    .map(({ id, key, title, status, project }) => ({ id, key, title, status, project }));
}

async function searchProjects(supabase: Client, ws: string, q: string, limit: number) {
  const base = () =>
    supabase
      .from("projects")
      .select("id, key, name, color, icon, status, access")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("name")
      .limit(limit);
  const pattern = likePattern(q);
  const [byName, byKey] = await Promise.all([base().ilike("name", pattern), base().ilike("key", pattern)]);
  return mergeById([unwrap("프로젝트", byName), unwrap("프로젝트", byKey)], (p) => p.id)
    .filter((p) => containsQuery(p.name, q) || containsQuery(p.key, q))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .slice(0, limit);
}

// 표시 이름·색 규칙은 lib/tasks/queries.ts의 selectMembers와 같다
async function searchPeople(supabase: Client, ws: string, q: string, limit: number) {
  const base = () =>
    supabase
      .from("workspace_members")
      .select("user_id, role, color, profiles!inner(name, email, color)")
      .eq("workspace_id", ws)
      .neq("status", "deactivated")
      .limit(limit);
  const pattern = likePattern(q);
  const [byName, byEmail] = await Promise.all([
    base().ilike("profiles.name", pattern),
    base().ilike("profiles.email", pattern),
  ]);
  return mergeById([unwrap("구성원", byName), unwrap("구성원", byEmail)], (m) => m.user_id)
    .filter((m) => containsQuery(m.profiles.name, q) || containsQuery(m.profiles.email, q))
    .map((m) => ({
      id: m.user_id,
      name: m.profiles.name || m.profiles.email || NAMELESS_MEMBER_LABEL,
      email: m.profiles.email ?? "",
      color: m.color ?? m.profiles.color ?? "indigo",
      role: m.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .slice(0, limit);
}

async function searchFiles(supabase: Client, ws: string, q: string, limit: number) {
  const r = await supabase
    .from("files")
    .select(
      `id, name, type,
      project:projects!files_project_id_workspace_id_fkey!inner(key, name),
      task:tasks!files_task_id_project_id_fkey(key, deleted_at)`,
    )
    .eq("workspace_id", ws)
    .eq("status", "ready")
    .is("deleted_at", null)
    .is("project.deleted_at", null)
    .is("project.archived_at", null)
    .ilike("name", likePattern(q))
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap("파일", r)
    .filter((f) => containsQuery(f.name, q))
    .map(({ id, name, type, project, task }) => ({
      id,
      name,
      type,
      project,
      // 연결 작업이 삭제됐으면 프로젝트 파일 화면으로 보낸다
      taskKey: task && !task.deleted_at ? task.key : null,
    }));
}

// comments에는 workspace_id가 없어 작업으로 묶어 워크스페이스를 거른다
async function searchComments(supabase: Client, ws: string, q: string, limit: number) {
  const r = await supabase
    .from("comments")
    .select(
      `id, body, created_at,
      author:profiles!comments_author_id_fkey(name, email),
      task:tasks!inner(key, title, workspace_id, deleted_at, archived_at,
        project:projects!tasks_project_id_workspace_id_fkey!inner(deleted_at, archived_at))`,
    )
    .eq("task.workspace_id", ws)
    .is("deleted_at", null)
    .is("task.deleted_at", null)
    // 작업 검색과 같은 기준. 보관된 작업의 댓글도 뺀다
    .is("task.archived_at", null)
    .is("task.project.deleted_at", null)
    .is("task.project.archived_at", null)
    .ilike("body", likePattern(q))
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap("댓글", r)
    .filter((c) => containsQuery(c.body, q))
    .map((c) => ({
      id: c.id,
      excerpt: excerpt(c.body, q),
      taskKey: c.task.key,
      taskTitle: c.task.title,
      authorName: c.author ? c.author.name || c.author.email || NAMELESS_MEMBER_LABEL : UNKNOWN_USER_LABEL,
      createdAt: c.created_at,
    }));
}

// scope가 all이면 다섯 종류를 각각 limit개까지, 아니면 그 종류만. 정리 후 빈 검색어는 묻지 않는다
export async function searchWorkspace(
  workspaceId: string,
  q: string,
  scope: SearchScope,
  limit: number = SEARCH_LIMIT_DEFAULT,
): Promise<SearchResults> {
  const query = normalizeQuery(q);
  if (!query) return EMPTY;
  const n = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), SEARCH_LIMIT_MAX) : SEARCH_LIMIT_DEFAULT;
  const supabase = await createClient();
  const want = (s: SearchScope) => scope === "all" || scope === s;
  const [tasks, projects, people, files, comments] = await Promise.all([
    want("tasks") ? searchTasks(supabase, workspaceId, query, n) : [],
    want("projects") ? searchProjects(supabase, workspaceId, query, n) : [],
    want("people") ? searchPeople(supabase, workspaceId, query, n) : [],
    want("files") ? searchFiles(supabase, workspaceId, query, n) : [],
    want("comments") ? searchComments(supabase, workspaceId, query, n) : [],
  ]);
  return { tasks, projects, people, files, comments };
}
