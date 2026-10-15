// 조직 화면(구성원·팀·설정·초대) DB 오류를 한국어 문구로 바꾼다. 원문은 내보내지 않는다
import { MSG } from "@/lib/auth/errors";
import { taskErrorMessage } from "@/lib/tasks/errors";

// RPC·트리거가 errcode P0001로 던지는 고정 코드(rpc·rls·org 마이그레이션)
const ORG_MESSAGES: Record<string, string> = {
  unauthenticated: MSG.sessionExpired,
  forbidden: "이 작업을 할 권한이 없습니다.",
  not_found: "대상을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
  invalid_input: "입력값을 다시 확인해 주세요.",
  self_role_change: "자기 역할이나 상태는 바꿀 수 없습니다.",
  owner_only: "소유자와 관련된 변경은 소유자만 할 수 있습니다.",
  last_owner: "마지막 소유자는 역할을 바꾸거나 비활성화할 수 없습니다.",
  already_member: "이미 이 워크스페이스의 구성원입니다.",
  slug_invalid: MSG.slugInvalid,
  slug_taken: "이미 쓰이고 있는 URL입니다. 다른 URL을 입력해 주세요.",
  confirm_mismatch: "확인 입력이 워크스페이스 URL과 다릅니다.",
  files_remain:
    "남은 파일을 정리하지 못해 워크스페이스를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요. 이미 휴지통으로 옮겨진 프로젝트는 보관함에서 복원할 수 있습니다.",
};

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// unique 위반(23505)은 대상마다 뜻이 달라 호출부가 문구를 넘긴다
export function orgErrorMessage(error: DbError, duplicate?: string): string {
  if (error?.code === "P0001" && error.message && Object.hasOwn(ORG_MESSAGES, error.message)) {
    return ORG_MESSAGES[error.message];
  }
  if (error?.code === "23505" && duplicate) return duplicate;
  return taskErrorMessage(error);
}
