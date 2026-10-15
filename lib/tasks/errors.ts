// 작업 관련 DB·네트워크 오류를 화면에 보일 한국어 문구로 바꾼다. 원문은 내보내지 않는다
import { GENERIC_ERROR, MSG } from "@/lib/auth/errors";

// RPC가 errcode P0001로 던지는 고정 코드(context-notes "P1 커밋 시점 앱이 지켜야 할 DB 규칙")
const RPC_MESSAGES: Record<string, string> = {
  unauthenticated: MSG.sessionExpired,
  not_found: "작업을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
  forbidden: "이 작업을 할 권한이 없습니다.",
  project_deleted: "삭제된 프로젝트의 작업은 바꿀 수 없습니다.",
  invalid_state: "지금 상태에서는 할 수 없는 작업입니다.",
  invalid_input: "입력값을 다시 확인해 주세요.",
  conflict: "삭제한 뒤 다른 사람이 바꾼 작업이라 되돌릴 수 없습니다. 보관함에서 확인해 주세요.",
  key_exhausted: "이 프로젝트에서 더 이상 작업 번호를 만들 수 없습니다.",
  invalid_assignee: "워크스페이스 구성원만 담당자로 지정할 수 있습니다.",
};

// Postgres·PostgREST 오류 코드
const CODE_MESSAGES: Record<string, string> = {
  "23505": "이미 있는 항목입니다.",
  "23514": "입력값을 다시 확인해 주세요.",
  "23503": "연결된 항목을 찾을 수 없습니다.",
  "22P02": "입력값을 다시 확인해 주세요.",
  "22007": "날짜 형식이 올바르지 않습니다.",
  "42501": "이 작업을 할 권한이 없습니다.",
  PGRST116: "작업을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
};

export const NETWORK_ERROR = "서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

export function taskErrorMessage(error: DbError): string {
  if (!error) return GENERIC_ERROR;
  if (error.code === "P0001" && error.message && Object.hasOwn(RPC_MESSAGES, error.message)) {
    return RPC_MESSAGES[error.message];
  }
  if (error.code && Object.hasOwn(CODE_MESSAGES, error.code)) return CODE_MESSAGES[error.code];
  // supabase-js는 fetch 실패를 code 없이 "TypeError: fetch failed" 같은 message로 돌려준다
  if (!error.code && error.message && /fetch|network/i.test(error.message)) return NETWORK_ERROR;
  return GENERIC_ERROR;
}
