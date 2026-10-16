// 프로젝트·보관함 관련 DB·Storage 오류를 현재 로캘 문구로 바꾼다. 작업 오류 변환(taskErrorMessage)을 프로젝트 문구로 덮어 확장한다
import type { MessageKey } from "@/lib/i18n/messages/types";
import type { T } from "@/lib/i18n/t";
import { taskErrorMessage } from "@/lib/tasks/errors";

// 프로젝트 RPC가 errcode P0001로 던지는 코드
const PROJECT_RPC_MESSAGES: Record<string, MessageKey> = {
  not_found: "projects.errors.notFound",
  forbidden: "projects.errors.forbidden",
  invalid_state: "projects.errors.invalidState",
  // 작업 쪽 문구는 "보관함에서 확인"을 안내해 보관함 안에서는 맞지 않는다
  conflict: "projects.errors.conflict",
  key_exhausted: "projects.errors.keyExhausted",
  project_deleted: "projects.errors.projectDeleted",
  // purge_project가 저장소에 첨부 파일이 남아 있으면 거부한다
  files_remain: "projects.errors.filesRemain",
};

const PROJECT_CODE_MESSAGES: Record<string, MessageKey> = {
  "23505": "projects.errors.keyTaken",
  "23514": "projects.errors.checkFailed",
  "42501": "projects.errors.forbidden",
  PGRST116: PROJECT_RPC_MESSAGES.not_found,
};

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// 위 표의 키는 모두 자리 표시자가 없다
const say = (t: T, key: MessageKey) => (t as (key: string) => string)(key);

export function projectErrorMessage(error: DbError, t: T): string {
  if (error?.code === "P0001" && error.message && Object.hasOwn(PROJECT_RPC_MESSAGES, error.message)) {
    return say(t, PROJECT_RPC_MESSAGES[error.message]);
  }
  if (error?.code && Object.hasOwn(PROJECT_CODE_MESSAGES, error.code)) return say(t, PROJECT_CODE_MESSAGES[error.code]);
  return taskErrorMessage(error, t);
}
