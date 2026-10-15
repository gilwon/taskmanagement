// 초대 이메일 파싱과 역할 변경 가능 범위 검증
import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canOpenOrgScreens,
  canOpenSettingsSection,
  parseInviteEmails,
} from "@/lib/org/rules";

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

describe("canOpenOrgScreens·canOpenSettingsSection", () => {
  it("게스트는 조직 화면과 그 설정 섹션을 열 수 없다", () => {
    expect(canOpenOrgScreens("guest")).toBe(false);
    expect(canOpenSettingsSection("guest", "members")).toBe(false);
    expect(canOpenSettingsSection("guest", "permissions")).toBe(false);
  });
  it("게스트도 개인 설정과 그 밖의 섹션은 연다", () => {
    expect(canOpenSettingsSection("guest", "profile")).toBe(true);
    expect(canOpenSettingsSection("guest", "general")).toBe(true);
  });
  it("구성원은 모두 연다", () => {
    expect(canOpenOrgScreens("member")).toBe(true);
    expect(canOpenSettingsSection("member", "members")).toBe(true);
  });
  it("소속이 아니면 모두 막는다", () => {
    expect(canOpenOrgScreens(null)).toBe(false);
    expect(canOpenSettingsSection(undefined, "profile")).toBe(false);
  });
});
