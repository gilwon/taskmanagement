"use server";
// 파일 Server Action. 업로드 준비(행 생성 + 서명 업로드 URL), 완료·실패·재시도, 다운로드·미리보기 서명 URL, 삭제·복원, 작업 연결.
// 파일 본문은 받지 않는다(브라우저가 서명 URL로 Storage에 직접 올린다). 입력은 매번 다시 검증하고 RLS가 걸린 세션 클라이언트로만 쓴다
import { isDemoUser } from "@/lib/demo/config";
import { fileErrorMessage } from "@/lib/files/errors";
import { checkUpload } from "@/lib/files/mime";
import { FILE_SELECT, selectFilePerms, selectFiles, toFileItem } from "@/lib/files/queries";
import type { FileItem, UploadTicket } from "@/lib/files/types";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/tasks/types";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };

const BUCKET = "files";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 다운로드·미리보기 서명 URL 유효기간(초)
const SIGNED_URL_TTL = 60;
const MAX_PREVIEWS = 200;

class InputError extends Error {}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function err<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function dbErr<R>(what: string, error: DbError, t: T): ActionResult<R> {
  console.error(`[${what}]`, error.code, error.message);
  return err(fileErrorMessage(error, t));
}

// Server Action은 직접 POST로도 불릴 수 있다. 매번 검증된 클레임으로 사용자를 확인한다
async function session(): Promise<{ supabase: Client; uid: string; demo: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  return uid ? { supabase, uid, demo: isDemoUser(data.claims) } : null;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new InputError();
  return value;
}

function optUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

// 검증 실패와 예상하지 못한 예외를 결과로 바꾼다. 실패를 빈 성공으로 숨기지 않는다
async function run<R>(
  what: string,
  body: (s: { supabase: Client; uid: string; demo: boolean; t: T }) => Promise<ActionResult<R>>,
) {
  const t = await getT();
  try {
    const s = await session();
    if (!s) return err<R>(t("errors.msg.sessionExpired"));
    return await body({ ...s, t });
  } catch (e) {
    if (e instanceof InputError) return err<R>(t("errors.rpc.invalidInput"));
    console.error(`[${what}]`, e);
    return err<R>(fileErrorMessage({ message: e instanceof Error ? e.message : String(e) }, t));
  }
}

async function readFile(supabase: Client, id: string) {
  const { data, error } = await supabase.from("files").select(FILE_SELECT).eq("id", id).single();
  return { file: data ? toFileItem(data) : null, error };
}

// 서명 업로드 URL. 재시도는 실패 전에 일부라도 올라간 객체를 덮어써야 해서 upsert를 켠다
async function signUpload(supabase: Client, path: string, upsert: boolean) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert });
  if (error) console.error("[서명 업로드 URL]", error.message);
  return data?.signedUrl ?? null;
}

// 업로드 준비. 크기·형식을 다시 검사하고(브라우저 MIME은 믿지 않는다) pending 행을 만든 뒤 서명 업로드 URL을 돌려준다.
// 확장자는 따로 받지 않고 name에서 서버가 뽑는다
export async function prepareUpload(
  projectId: string,
  taskId: string | null,
  name: string,
  size: number,
): Promise<ActionResult<UploadTicket>> {
  return run("업로드 준비", async ({ supabase, uid, demo, t }) => {
    // 데모 사본은 Storage 객체를 남기지 않도록 업로드를 막는다(Storage 정책도 거부한다)
    if (demo) return err(t("errors.msg.demoRestricted"));
    const pid = uuid(projectId);
    const tid = optUuid(taskId);
    if (typeof name !== "string" || typeof size !== "number") throw new InputError();
    const check = checkUpload(name, size, t);
    if (!check.ok) return err(check.error);

    const project = await supabase.from("projects").select("id, workspace_id").eq("id", pid).single();
    if (project.error) return dbErr("업로드 준비 프로젝트", project.error, t);

    // storage_path check가 행 id를 포함하므로 id를 먼저 정한다
    const id = crypto.randomUUID();
    const storagePath = `${project.data.workspace_id}/${pid}/${id}/${check.objectName}`;
    const inserted = await supabase
      .from("files")
      .insert({
        id,
        workspace_id: project.data.workspace_id,
        project_id: pid,
        task_id: tid,
        name: check.name,
        object_name: check.objectName,
        type: check.type,
        mime: check.mime,
        size_bytes: size,
        storage_path: storagePath,
        uploaded_by: uid,
      })
      .select(FILE_SELECT)
      .single();
    if (inserted.error) return dbErr("업로드 준비 행", inserted.error, t);

    const url = await signUpload(supabase, storagePath, false);
    if (!url) {
      // pending 고아를 남기지 않고 실패로 돌려 재시도·삭제할 수 있게 한다
      await supabase.rpc("fail_file", { p_file: id });
      return err(t("files.errors.uploadUrlFailed"));
    }
    return ok({ file: toFileItem(inserted.data), url, mime: check.mime });
  });
}

// Storage 업로드가 끝난 뒤. 객체 존재·크기를 DB가 확인하고 ready로 바꾼다. 실패하면 행을 failed로 돌린다
export async function finalizeUpload(fileId: string): Promise<ActionResult<null>> {
  return run("업로드 완료", async ({ supabase, t }) => {
    const id = uuid(fileId);
    const { error } = await supabase.rpc("finalize_file", { p_file: id });
    if (error) {
      await supabase.rpc("fail_file", { p_file: id });
      return dbErr("업로드 완료", error, t);
    }
    return ok(null);
  });
}

// 업로드 실패·취소
export async function failUpload(fileId: string): Promise<ActionResult<null>> {
  return run("업로드 실패 기록", async ({ supabase, t }) => {
    const { error } = await supabase.rpc("fail_file", { p_file: uuid(fileId) });
    if (error) return dbErr("업로드 실패 기록", error, t);
    return ok(null);
  });
}

// 다시 올리기. 끊겨 pending으로 남은 본인 업로드는 먼저 failed로 돌린 뒤 retry_file로 pending에 놓고 새 서명 URL을 준다
export async function retryUpload(fileId: string): Promise<ActionResult<UploadTicket>> {
  return run("업로드 재시도", async ({ supabase, uid, demo, t }) => {
    if (demo) return err(t("errors.msg.demoRestricted"));
    const id = uuid(fileId);
    const row = await supabase
      .from("files")
      .select("status, uploaded_by, storage_path, mime")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (row.error) return dbErr("업로드 재시도 조회", row.error, t);
    // 다른 사람이 올리는 중인 pending 행은 건드리지 않는다
    if (row.data.status === "pending" && row.data.uploaded_by === uid) {
      const failed = await supabase.rpc("fail_file", { p_file: id });
      if (failed.error) return dbErr("업로드 재시도 실패 기록", failed.error, t);
    }
    const retried = await supabase.rpc("retry_file", { p_file: id });
    if (retried.error) return dbErr("업로드 재시도", retried.error, t);
    const url = await signUpload(supabase, row.data.storage_path, true);
    if (!url) {
      await supabase.rpc("fail_file", { p_file: id });
      return err(t("files.errors.uploadUrlFailed"));
    }
    const { file, error } = await readFile(supabase, id);
    if (error || !file) return dbErr("업로드 재시도 다시 읽기", error ?? { message: "no row" }, t);
    return ok({ file, url, mime: row.data.mime });
  });
}

// 다운로드 서명 URL. RLS로 볼 수 있는 완료 파일만, 60초 유효, 원본 이름으로 내려받게 한다
export async function fileDownloadUrl(fileId: string): Promise<ActionResult<string>> {
  return run("다운로드 주소", async ({ supabase, t }) => {
    const row = await supabase
      .from("files")
      .select("name, storage_path")
      .eq("id", uuid(fileId))
      .eq("status", "ready")
      .is("deleted_at", null)
      .single();
    if (row.error) return dbErr("다운로드 주소 조회", row.error, t);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.data.storage_path, SIGNED_URL_TTL);
    if (error || !data) {
      console.error("[다운로드 주소]", error?.message);
      return err(t("files.errors.downloadUrlFailed"));
    }
    // storage-js 2.117의 download 옵션은 URL 전체에 encodeURI를 한 번 더 걸어 한글 이름이 %XX 그대로 저장된다. 직접 한 번만 인코딩해 붙인다
    return ok(`${data.signedUrl}&download=${encodeURIComponent(row.data.name)}`);
  });
}

// 이미지 미리보기 서명 URL을 한 번에 만든다. 결과는 { 파일 id: URL }. 실패한 항목은 뺀다
export async function previewUrls(fileIds: string[]): Promise<ActionResult<Record<string, string>>> {
  return run("미리보기 주소", async ({ supabase, t }) => {
    if (!Array.isArray(fileIds) || fileIds.length === 0 || fileIds.length > MAX_PREVIEWS) throw new InputError();
    const ids = [...new Set(fileIds.map(uuid))];
    const rows = await supabase
      .from("files")
      .select("id, storage_path")
      .in("id", ids)
      .eq("type", "img")
      .eq("status", "ready")
      .is("deleted_at", null);
    if (rows.error) return dbErr("미리보기 주소 조회", rows.error, t);
    if (rows.data.length === 0) return ok({});
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(
      rows.data.map((r) => r.storage_path),
      SIGNED_URL_TTL,
    );
    if (error) {
      console.error("[미리보기 주소]", error.message);
      return ok({});
    }
    const byPath = new Map(rows.data.map((r) => [r.storage_path, r.id]));
    const out: Record<string, string> = {};
    for (const d of data) {
      const id = d.path && byPath.get(d.path);
      if (id && d.signedUrl && !d.error) out[id] = d.signedUrl;
    }
    return ok(out);
  });
}

// 소프트 삭제. 돌려받은 토큰(updated_at 문자열)을 그대로 restoreFile에 넘긴다
export async function deleteFile(fileId: string): Promise<ActionResult<{ token: string }>> {
  return run("파일 삭제", async ({ supabase, t }) => {
    const { data, error } = await supabase.rpc("soft_delete_file", { p_file: uuid(fileId) });
    if (error) return dbErr("파일 삭제", error, t);
    return ok({ token: data });
  });
}

export async function restoreFile(fileId: string, token: string): Promise<ActionResult<FileItem>> {
  return run("파일 복원", async ({ supabase, t }) => {
    const id = uuid(fileId);
    if (typeof token !== "string" || token.length > 64) throw new InputError();
    const { error } = await supabase.rpc("restore_file", { p_file: id, p_token: token });
    if (error) return dbErr("파일 복원", error, t);
    const { file, error: readError } = await readFile(supabase, id);
    if (readError || !file) return dbErr("파일 복원 다시 읽기", readError ?? { message: "no row" }, t);
    return ok(file);
  });
}

// 작업 연결·해제. 클라이언트가 바꿀 수 있는 files 컬럼은 task_id뿐이고, 같은 프로젝트 작업인지는 복합 FK가 막는다
export async function linkFileTask(fileId: string, taskId: string | null): Promise<ActionResult<FileItem>> {
  return run("파일 작업 연결", async ({ supabase, t }) => {
    const id = uuid(fileId);
    const { data, error } = await supabase
      .from("files")
      .update({ task_id: optUuid(taskId) })
      .eq("id", id)
      .select(FILE_SELECT)
      .single();
    if (error) return dbErr("파일 작업 연결", error, t);
    return ok(toFileItem(data));
  });
}

// 드로어 첨부 목록. 작업 파일(최신 200건, queries의 shortcut 참고), 편집·관리 권한, 내 id(재시도 버튼 판단)
export async function listTaskFiles(
  taskId: string,
): Promise<ActionResult<{ files: FileItem[]; canEdit: boolean; canManage: boolean; meId: string }>> {
  return run("작업 첨부 목록", async ({ supabase, uid, t }) => {
    const tid = uuid(taskId);
    const task = await supabase.from("tasks").select("project_id").eq("id", tid).single();
    if (task.error) return dbErr("작업 첨부 작업", task.error, t);
    const [files, perms] = await Promise.all([
      selectFiles(supabase, { taskId: tid }),
      selectFilePerms(supabase, task.data.project_id),
    ]);
    if (files.error) return dbErr("작업 첨부 목록", files.error, t);
    if (perms.error) return dbErr("작업 첨부 권한", perms.error, t);
    return ok({ files: files.files, canEdit: perms.canEdit, canManage: perms.canManage, meId: uid });
  });
}
