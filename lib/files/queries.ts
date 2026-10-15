// 파일 조회. 프로젝트·작업의 파일 목록, 연결할 작업 목록, 편집 권한을 RLS가 걸린 세션 클라이언트로 읽는다
import { createClient } from "@/lib/supabase/server";
import type { FileItem, LinkableTask } from "@/lib/files/types";
import { NAMELESS_MEMBER_LABEL } from "@/lib/i18n/labels";

type Client = Awaited<ReturnType<typeof createClient>>;

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
  const { data, error } = await q.order("created_at", { ascending: false }).order("id");
  return { files: data?.map(toFileItem) ?? [], error };
}

// 프로젝트 파일 화면용. 파일, 연결할 작업 후보, 편집 권한(업로드·삭제 버튼 표시용, 최종 판정은 RLS)
export async function getProjectFilesPage(projectId: string) {
  const supabase = await createClient();
  const [files, tasks, canEdit] = await Promise.all([
    selectFiles(supabase, { projectId }),
    supabase
      .from("tasks")
      .select("id, key, title")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("can_edit_project", { p: projectId }),
  ]);
  // DB 오류를 빈 결과로 바꾸지 않고 오류 경계로 올린다(spec R22)
  const error = files.error ?? tasks.error ?? canEdit.error;
  if (error) {
    console.error("[프로젝트 파일]", error.message);
    throw new Error("파일 목록을 불러오지 못했습니다.");
  }
  return { files: files.files, tasks: (tasks.data ?? []) as LinkableTask[], canEdit: canEdit.data === true };
}
