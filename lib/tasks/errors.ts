// 작업 관련 DB·네트워크 오류를 화면에 보일 안내로 바꾼다. 원문은 내보내지 않는다.
// 문구는 사전(tasks.errors·errors 영역)에 있고, t를 넘기면 그 로캘로, 넘기지 않으면 한국어로 돌려준다
import koCommon from "@/lib/i18n/messages/ko/common";
import koErrors from "@/lib/i18n/messages/ko/errors";
import koTasks from "@/lib/i18n/messages/ko/tasks";
import type { MessageKey, Messages } from "@/lib/i18n/messages/types";
import { createT, type T } from "@/lib/i18n/t";

// 한국어 기본값. 오류 안내(tasks.errors·errors)와 묶음 이름(tasks.view·common 라벨)만 담은 t를 만든다
export const koTasksT = createT(
  { tasks: { errors: koTasks.errors, view: koTasks.view }, common: koCommon, errors: koErrors } as unknown as Messages,
  "ko",
);

// RPC가 errcode P0001로 던지는 고정 코드(context-notes "P1 커밋 시점 앱이 지켜야 할 DB 규칙")
const RPC_MESSAGES: Record<string, MessageKey> = {
  unauthenticated: "errors.msg.sessionExpired",
  not_found: "tasks.errors.notFound",
  forbidden: "tasks.errors.forbidden",
  project_deleted: "tasks.errors.projectDeleted",
  invalid_state: "tasks.errors.invalidState",
  invalid_input: "errors.rpc.invalidInput",
  conflict: "tasks.errors.conflict",
  key_exhausted: "tasks.errors.keyExhausted",
  invalid_assignee: "tasks.errors.invalidAssignee",
};

// Postgres·PostgREST 오류 코드
const CODE_MESSAGES: Record<string, MessageKey> = {
  "23505": "tasks.errors.duplicate",
  "23514": "errors.rpc.invalidInput",
  "23503": "tasks.errors.missingRef",
  "22P02": "errors.rpc.invalidInput",
  "22007": "tasks.errors.invalidDate",
  "42501": "tasks.errors.forbidden",
  PGRST116: "tasks.errors.notFound",
};

// 한국어 값. 로캘별 문구는 t("tasks.errors.network")로 쓴다
export const NETWORK_ERROR = koTasks.errors.network;

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// 자리 표시자가 없는 키만 담으므로 인자 없이 부른다
const say = (t: T, key: MessageKey) => (t as (key: string) => string)(key);

export function taskErrorMessage(error: DbError, t: T = koTasksT): string {
  if (!error) return t("errors.generic");
  if (error.code === "P0001" && error.message && Object.hasOwn(RPC_MESSAGES, error.message)) {
    return say(t, RPC_MESSAGES[error.message]);
  }
  if (error.code && Object.hasOwn(CODE_MESSAGES, error.code)) return say(t, CODE_MESSAGES[error.code]);
  // supabase-js는 fetch 실패를 code 없이 "TypeError: fetch failed" 같은 message로 돌려준다
  if (!error.code && error.message && /fetch|network/i.test(error.message)) return t("tasks.errors.network");
  return t("errors.generic");
}
