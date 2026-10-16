// 조직 화면(구성원·팀·설정·초대) DB 오류를 화면 문구로 바꾼다. 원문은 내보내지 않는다.
// 문구는 사전(errors·org 영역)에 있고, t를 넘기면 그 로캘로, 넘기지 않으면 한국어로 돌려준다
import koErrors from "@/lib/i18n/messages/ko/errors";
import koOrg from "@/lib/i18n/messages/ko/org";
import type { MessageKey, Messages } from "@/lib/i18n/messages/types";
import { createT, type T } from "@/lib/i18n/t";
import { taskErrorMessage } from "@/lib/tasks/errors";

// 한국어 기본값. errors·org 영역만 담은 t라 그 밖의 키는 찾을 수 없다
const koT = createT({ errors: koErrors, org: koOrg } as unknown as Messages, "ko");

// RPC·트리거가 errcode P0001로 던지는 고정 코드(rpc·rls·org 마이그레이션)
const ORG_MESSAGES: Record<string, MessageKey> = {
  unauthenticated: "errors.msg.sessionExpired",
  forbidden: "errors.rpc.forbidden",
  not_found: "org.errors.notFound",
  invalid_input: "errors.rpc.invalidInput",
  self_role_change: "org.errors.selfRoleChange",
  owner_only: "org.errors.ownerOnly",
  last_owner: "org.errors.lastOwner",
  already_member: "org.errors.alreadyMember",
  slug_invalid: "errors.msg.slugInvalid",
  slug_taken: "errors.rpc.slugTaken",
  confirm_mismatch: "org.errors.confirmMismatch",
  files_remain: "org.errors.filesRemain",
};

type DbError = { code?: string | null; message?: string | null } | null | undefined;

// unique 위반(23505)은 대상마다 뜻이 달라 호출부가 문구를 넘긴다.
// t가 없으면 한국어다. 폴백(taskErrorMessage)에도 넘긴 t만 전한다(koT에는 tasks 영역 키가 없다)
export function orgErrorMessage(error: DbError, t?: T, duplicate?: string): string {
  if (error?.code === "P0001" && error.message && Object.hasOwn(ORG_MESSAGES, error.message)) {
    return ((t ?? koT) as (key: string) => string)(ORG_MESSAGES[error.message]);
  }
  if (error?.code === "23505" && duplicate) return duplicate;
  return taskErrorMessage(error, t);
}
