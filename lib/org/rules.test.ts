// 초대 이메일 파싱과 역할 변경 가능 범위 검증
import { describe, expect, it } from "vitest";
import { assignableRoles, parseInviteEmails } from "@/lib/org/rules";

describe("parseInviteEmails", () => {
  it("구분자로 나누고 소문자·중복 제거한다", () => {
    expect(parseInviteEmails(" A@x.io, b@x.io;\na@X.io  bad ")).toEqual({
      emails: ["a@x.io", "b@x.io"],
      invalid: ["bad"],
    });
  });
  it("빈 입력은 빈 목록이다", () => {
    expect(parseInviteEmails("  \n ")).toEqual({ emails: [], invalid: [] });
  });
});

describe("assignableRoles", () => {
  it("자기 자신은 바꿀 수 없다", () => {
    expect(assignableRoles("owner", "owner", true)).toEqual([]);
  });
  it("관리자는 소유자 행을 바꿀 수 없고 소유자를 줄 수 없다", () => {
    expect(assignableRoles("admin", "owner", false)).toEqual([]);
    expect(assignableRoles("admin", "member", false)).toEqual(["admin", "member", "guest"]);
  });
  it("소유자는 모든 역할을 줄 수 있다", () => {
    expect(assignableRoles("owner", "guest", false)).toContain("owner");
  });
  it("구성원·게스트는 아무것도 바꿀 수 없다", () => {
    expect(assignableRoles("member", "guest", false)).toEqual([]);
    expect(assignableRoles(null, "guest", false)).toEqual([]);
  });
});
