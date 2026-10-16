// 파일 조회. 프로젝트·작업의 파일 목록, 연결할 작업 목록, 편집·관리 권한을 RLS가 걸린 세션 클라이언트로 읽는다
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FileItem, LinkableTask } from "@/lib/files/types";
import { NAMELESS_MEMBER_LABEL } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// shortcut: 프로젝트 파일은 최신 500건, 작업 첨부는 200건, 연결 후보 작업은 최신 1000건까지만 읽는다. 넘는 프로젝트가 생기면 페이지네이션·서버 검색으로 바꾼다
const PROJECT_FILE_LIMIT = 500;
const TASK_FILE_LIMIT = 200;
const LINKABLE_TASK_LIMIT = 1000;

export const FILE_SELECT =
  "id, project_id, task_id, name, type, mime, size_bytes, status, created_at, uploaded_by, uploader:profiles(name, email, color), task:tasks(id, key, title, deleted_at)";

type RawFile = Omit<FileItem, "uploader" | "task"> & {
  uploader: { name: string; email: string; color: string } | null;
  task: { id: string; key: string; title: string; deleted_at: string | null } | null;
};

export function toFileItem(r: RawFile): FileItem {
  const { uploader: u, task: t, ...rest } = r;
  return {
    ...rest,
    uploader: u ? { name: u.name || u.email || NAMELESS_MEMBER_LABEL, color: u.color } : null,
    task: t && !t.deleted_at ? { id: t.id, key: t.key, title: t.title } : null,
  };
}

// 삭제되지 않은 파일. 업로드 중·실패 행도 보인다(완료로 표시하지 않는다). 최신순
export async function selectFiles(supabase: Client, by: { projectId: string } | { taskId: string }) {
  let q = supabase.from("files").select(FILE_SELECT).is("deleted_at", null);
  q = "projectId" in by ? q.eq("project_id", by.projectId) : q.eq("task_id", by.taskId);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .limit("projectId" in by ? PROJECT_FILE_LIMIT : TASK_FILE_LIMIT);
  return { files: data?.map(toFileItem) ?? [], error };
}

// 편집 권한(업로드·삭제 버튼)과 관리 권한(남의 실패 업로드 재시도, retry_file 규칙). 최종 판정은 RLS·RPC
export async function selectFilePerms(supabase: Client, projectId: string) {
  const [edit, manage] = await Promise.all([
    supabase.rpc("can_edit_project", { p: projectId }),
    supabase.rpc("can_manage_project", { p: projectId }),
  ]);
  return { canEdit: edit.data === true, canManage: manage.data === true, error: edit.error ?? manage.error };
}

// 프로젝트 파일 화면용. 파일, 연결할 작업 후보, 권한
export async function getProjectFilesPage(projectId: string) {
  const supabase = await createClient();
  const [files, tasks, perms] = await Promise.all([
    selectFiles(supabase, { projectId }),
    supabase
      .from("tasks")
      .select("id, key, title")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LINKABLE_TASK_LIMIT),
    selectFilePerms(supabase, projectId),
  ]);
  // DB 오류를 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  const error = files.error ?? tasks.error ?? perms.error;
  if (error) {
    console.error("[프로젝트 파일]", error.message);
    throw new Error((await getT())("files.errors.listFailed"));
  }
  return {
    files: files.files,
    tasks: (tasks.data ?? []) as LinkableTask[],
    canEdit: perms.canEdit,
    canManage: perms.canManage,
  };
}
