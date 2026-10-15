// 작업 오류 코드 → 한국어 문구 변환을 고정한다. 원문은 내보내지 않는다(spec R22)
import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, MSG } from "@/lib/auth/errors";
import { NETWORK_ERROR, taskErrorMessage } from "@/lib/tasks/errors";

describe("taskErrorMessage", () => {
  it("RPC 고정 코드(P0001)를 바꾼다", () => {
    expect(taskErrorMessage({ code: "P0001", message: "forbidden" })).toBe("이 작업을 할 권한이 없습니다.");
    expect(taskErrorMessage({ code: "P0001", message: "not_found" })).toMatch(/찾을 수 없습니다/);
    expect(taskErrorMessage({ code: "P0001", message: "project_deleted" })).toMatch(/삭제된 프로젝트/);
    expect(taskErrorMessage({ code: "P0001", message: "invalid_state" })).toMatch(/지금 상태/);
    expect(taskErrorMessage({ code: "P0001", message: "conflict" })).toMatch(/되돌릴 수 없습니다/);
    expect(taskErrorMessage({ code: "P0001", message: "unauthenticated" })).toBe(MSG.sessionExpired);
    expect(taskErrorMessage({ code: "P0001", message: "invalid_assignee" })).toBe(
      "워크스페이스 구성원만 담당자로 지정할 수 있습니다.",
    );
  });

  it("Postgres 오류 코드를 바꾼다", () => {
    expect(taskErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("이미 있는 항목입니다.");
    expect(taskErrorMessage({ code: "23514", message: 'violates check constraint "tasks_check"' })).toBe("입력값을 다시 확인해 주세요.");
    expect(taskErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/권한/);
  });

  it("모르는 코드·P0001의 모르는 message는 일반 안내로 바꾸고 원문을 내보내지 않는다", () => {
    expect(taskErrorMessage({ code: "P0001", message: "secret internal detail" })).toBe(GENERIC_ERROR);
    expect(taskErrorMessage({ code: "XX000", message: "relation tasks does not exist" })).toBe(GENERIC_ERROR);
    expect(taskErrorMessage(null)).toBe(GENERIC_ERROR);
  });

  it("코드 없는 fetch 실패는 네트워크 안내", () => {
    expect(taskErrorMessage({ message: "TypeError: fetch failed" })).toBe(NETWORK_ERROR);
  });
});
