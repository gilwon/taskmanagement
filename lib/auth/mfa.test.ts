// 2단계 인증 순수 규칙(코드 형식, 단계 필요 여부, 단계 화면 주소)을 검증한다
import { describe, expect, it } from "vitest";
import { isMfaExemptPath, mfaStepPath, needsMfaStep, normalizeTotpCode } from "@/lib/auth/mfa";

describe("normalizeTotpCode", () => {
  it("6자리 숫자만 통과시키고 공백은 지운다", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
    expect(normalizeTotpCode(" 123 456 ")).toBe("123456");
  });
  it("자릿수가 다르거나 숫자가 아니면 null이다", () => {
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("1234567")).toBeNull();
    expect(normalizeTotpCode("12345a")).toBeNull();
    expect(normalizeTotpCode("")).toBeNull();
  });
});

describe("needsMfaStep", () => {
  it("aal1이고 다음 단계가 aal2일 때만 true다", () => {
    expect(needsMfaStep("aal1", "aal2")).toBe(true);
    expect(needsMfaStep("aal2", "aal2")).toBe(false);
    expect(needsMfaStep("aal1", "aal1")).toBe(false);
    expect(needsMfaStep(null, null)).toBe(false);
    expect(needsMfaStep(undefined, "aal2")).toBe(false);
  });
});

describe("mfaStepPath", () => {
  it("next를 인코딩해 붙인다", () => {
    expect(mfaStepPath("/acme/home?a=1")).toBe("/login/mfa?next=%2Facme%2Fhome%3Fa%3D1");
  });
  it("안전하지 않은 next는 /로 바꾼다", () => {
    expect(mfaStepPath("//evil.com")).toBe("/login/mfa?next=%2F");
    expect(mfaStepPath(null)).toBe("/login/mfa?next=%2F");
  });
});

describe("isMfaExemptPath", () => {
  it("코드 확인 화면과 로그아웃만 예외다", () => {
    expect(isMfaExemptPath("/login/mfa")).toBe(true);
    expect(isMfaExemptPath("/auth/signout")).toBe(true);
    expect(isMfaExemptPath("/acme/home")).toBe(false);
  });
});
