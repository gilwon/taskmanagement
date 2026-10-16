// 파일 관련 DB·Storage·네트워크 오류를 현재 로캘 문구로 바꾼다. 작업 오류 변환(taskErrorMessage)을 파일 문구로 덮어 확장한다.
// 문구는 사전(files.errors)에 있고, t를 넘기지 않으면 한국어로 돌려준다
import { NETWORK_ERROR, taskErrorMessage } from "@/lib/tasks/errors";
import { MAX_FILE_LABEL } from "@/lib/files/mime";
import koFiles from "@/lib/i18n/messages/ko/files";
import type { MessageKey, Messages } from "@/lib/i18n/messages/types";
import { createT, type T } from "@/lib/i18n/t";

// 한국어 기본값. 클라이언트 번들에 사전 전체가 실리지 않게 files 영역만 담는다
const koT = createT({ files: koFiles } as unknown as Messages, "ko");

// 파일 RPC(finalize_file 등)가 errcode P0001로 던지는 코드
const FILE_RPC_MESSAGES = {
  not_found: "files.errors.notFound",
  forbidden: "files.errors.forbidden",
  project_deleted: "files.errors.projectDeleted",
  invalid_state: "files.errors.invalidState",
  conflict: "files.errors.conflict",
  upload_incomplete: "files.errors.uploadIncomplete",
  size_mismatch: "files.errors.sizeMismatch",
  mime_mismatch: "files.errors.mimeMismatch",
} as const satisfies Record<string, MessageKey>;

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// t가 없으면 파일 문구는 koT, 작업 문구는 taskErrorMessage의 한국어 기본값을 쓴다
export function fileErrorMessage(error: DbError, t?: T): string {
  const say = t ?? koT;
  if (error?.code === "P0001" && error.message && Object.hasOwn(FILE_RPC_MESSAGES, error.message)) {
    return say(FILE_RPC_MESSAGES[error.message as keyof typeof FILE_RPC_MESSAGES]);
  }
  if (error?.code === "PGRST116") return say(FILE_RPC_MESSAGES.not_found);
  if (error?.code === "42501") return say(FILE_RPC_MESSAGES.forbidden);
  return taskErrorMessage(error, t);
}

// 브라우저가 Storage에 직접 올린 요청의 실패. status 0은 네트워크 끊김.
// 로컬 Storage는 크기·형식 거부를 HTTP 400으로 주고 본문 statusCode에 "413"·"415"를 담아 본문을 먼저 본다
export function storageUploadMessage(httpStatus: number, body = "", t: T = koT): string {
  if (httpStatus === 0) return t === koT ? NETWORK_ERROR : t("tasks.errors.network");
  let status = httpStatus;
  try {
    const code = Number((JSON.parse(body) as { statusCode?: unknown }).statusCode);
    if (Number.isInteger(code)) status = code;
  } catch {
    // 본문이 JSON이 아니면 HTTP 상태만 본다
  }
  if (status === 413) return t("files.errors.tooLarge", { max: MAX_FILE_LABEL });
  if (status === 415) return t("files.errors.unsupported");
  if (status === 401 || status === 403) return t("files.errors.uploadDenied");
  return t("files.errors.uploadFailed");
}
