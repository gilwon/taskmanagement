// 파일 관련 DB·Storage·네트워크 오류를 한국어 문구로 바꾼다. 작업 오류 변환(taskErrorMessage)을 파일 문구로 덮어 확장한다
import { NETWORK_ERROR, taskErrorMessage } from "@/lib/tasks/errors";
import { MAX_FILE_LABEL } from "@/lib/files/mime";

// 파일 RPC(finalize_file 등)가 errcode P0001로 던지는 코드
const FILE_RPC_MESSAGES: Record<string, string> = {
  not_found: "파일을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
  forbidden: "이 파일을 바꿀 권한이 없습니다.",
  project_deleted: "삭제된 프로젝트의 파일은 바꿀 수 없습니다.",
  invalid_state: "지금 상태에서는 할 수 없습니다. 새로고침한 뒤 다시 시도해 주세요.",
  conflict: "삭제한 뒤 바뀐 파일이라 되돌릴 수 없습니다.",
  upload_incomplete: "업로드가 끝나지 않았습니다. 다시 시도해 주세요.",
  size_mismatch: "올라간 파일 크기가 맞지 않습니다. 다시 시도해 주세요.",
  mime_mismatch: "올라간 파일 형식이 확장자와 맞지 않습니다. 원본 파일로 다시 시도해 주세요.",
};

export const UPLOAD_CANCELED = "업로드를 취소했습니다.";
export const UPLOAD_UNFINISHED = "업로드가 끝나지 않았습니다. 다시 시도하거나 삭제해 주세요.";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

export function fileErrorMessage(error: DbError): string {
  if (error?.code === "P0001" && error.message && Object.hasOwn(FILE_RPC_MESSAGES, error.message)) {
    return FILE_RPC_MESSAGES[error.message];
  }
  if (error?.code === "PGRST116") return FILE_RPC_MESSAGES.not_found;
  if (error?.code === "42501") return FILE_RPC_MESSAGES.forbidden;
  return taskErrorMessage(error);
}

// 브라우저가 Storage에 직접 올린 요청의 실패. status 0은 네트워크 끊김.
// 로컬 Storage는 크기·형식 거부를 HTTP 400으로 주고 본문 statusCode에 "413"·"415"를 담아 본문을 먼저 본다
export function storageUploadMessage(httpStatus: number, body = ""): string {
  if (httpStatus === 0) return NETWORK_ERROR;
  let status = httpStatus;
  try {
    const code = Number((JSON.parse(body) as { statusCode?: unknown }).statusCode);
    if (Number.isInteger(code)) status = code;
  } catch {
    // 본문이 JSON이 아니면 HTTP 상태만 본다
  }
  if (status === 413) return `파일당 최대 ${MAX_FILE_LABEL}까지 올릴 수 있습니다.`;
  if (status === 415) return "지원하지 않는 형식입니다.";
  if (status === 401 || status === 403) return "업로드 권한이 없거나 업로드 주소가 만료되었습니다. 다시 시도해 주세요.";
  return "파일을 올리지 못했습니다. 다시 시도해 주세요.";
}
