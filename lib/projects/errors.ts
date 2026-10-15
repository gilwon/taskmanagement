// 프로젝트·보관함 관련 DB·Storage 오류를 한국어 문구로 바꾼다. 작업 오류 변환(taskErrorMessage)을 프로젝트 문구로 덮어 확장한다
import { taskErrorMessage } from "@/lib/tasks/errors";

// 프로젝트 RPC가 errcode P0001로 던지는 코드
const PROJECT_RPC_MESSAGES: Record<string, string> = {
  not_found: "프로젝트를 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
  forbidden: "이 프로젝트를 바꿀 권한이 없습니다.",
  invalid_state: "지금 상태에서는 할 수 없습니다. 새로고침한 뒤 다시 시도해 주세요.",
  // 작업 쪽 문구는 "보관함에서 확인"을 안내해 보관함 안에서는 맞지 않는다
  conflict: "삭제한 뒤 다른 사람이 바꾼 항목이라 되돌릴 수 없습니다. 새로고침한 뒤 다시 확인해 주세요.",
  key_exhausted: "이 이름으로는 더 이상 프로젝트 키를 만들 수 없습니다. 이름을 바꿔 주세요.",
  project_deleted: "삭제된 프로젝트의 항목은 바꿀 수 없습니다. 프로젝트를 먼저 복원해 주세요.",
  // purge_project가 저장소에 첨부 파일이 남아 있으면 거부한다
  files_remain: "저장소에 첨부 파일이 남아 있어 영구 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

const PROJECT_CODE_MESSAGES: Record<string, string> = {
  "23505": "같은 키의 프로젝트가 방금 만들어졌습니다. 다시 시도해 주세요.",
  "23514": "입력값을 다시 확인해 주세요. 시작일은 기한보다 늦을 수 없습니다.",
  "42501": "이 프로젝트를 바꿀 권한이 없습니다.",
  PGRST116: PROJECT_RPC_MESSAGES.not_found,
};

// Storage 객체를 지우지 못해 영구 삭제를 멈췄을 때
export const STORAGE_REMOVE_FAILED = "첨부 파일을 저장소에서 지우지 못해 영구 삭제를 멈췄습니다. 잠시 후 다시 시도해 주세요.";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

export function projectErrorMessage(error: DbError): string {
  if (error?.code === "P0001" && error.message && Object.hasOwn(PROJECT_RPC_MESSAGES, error.message)) {
    return PROJECT_RPC_MESSAGES[error.message];
  }
  if (error?.code && Object.hasOwn(PROJECT_CODE_MESSAGES, error.code)) return PROJECT_CODE_MESSAGES[error.code];
  return taskErrorMessage(error);
}
