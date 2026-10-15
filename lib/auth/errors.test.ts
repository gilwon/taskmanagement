// 인증·RPC 오류 한국어 변환과 온보딩 입력 규칙을 검증한다
import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, authErrorMessage, rpcErrorMessage } from "@/lib/auth/errors";
import { RECOVERY_WINDOW_SEC, SLUG_RE, isRecoverySession, suggestSlug } from "@/lib/auth/rules";

describe("authErrorMessage", () => {
  it("아는 코드는 한국어 안내와 칸을 돌려준다", () => {
    expect(authErrorMessage("invalid_credentials").message).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
    expect(authErrorMessage("weak_password").field).toBe("password");
  });

  it("계정 존재를 드러내는 코드는 일반 안내다", () => {
    expect(authErrorMessage("user_already_exists")).toEqual({ message: GENERIC_ERROR });
    expect(authErrorMessage("email_exists")).toEqual({ message: GENERIC_ERROR });
  });

  it("모르는 코드나 빈 값은 일반 안내다", () => {
    expect(authErrorMessage("unexpected_failure")).toEqual({ message: GENERIC_ERROR });
    expect(authErrorMessage(undefined)).toEqual({ message: GENERIC_ERROR });
    expect(authErrorMessage("__proto__")).toEqual({ message: GENERIC_ERROR });
  });
});

describe("rpcErrorMessage", () => {
  it("P0001 고정 코드는 한국어로 바꾸고 slug 오류는 slug 칸에 붙인다", () => {
    expect(rpcErrorMessage({ code: "P0001", message: "slug_taken" }).field).toBe("slug");
    expect(rpcErrorMessage({ code: "P0001", message: "slug_invalid" }).field).toBe("slug");
    expect(rpcErrorMessage({ code: "P0001", message: "invalid_input" }).message).toBe("입력값을 다시 확인해 주세요.");
  });

  it("다른 errcode나 모르는 메시지는 원문을 숨기고 일반 안내다", () => {
    expect(rpcErrorMessage({ code: "23514", message: "new row violates check constraint" })).toEqual({
      message: GENERIC_ERROR,
    });
    expect(rpcErrorMessage({ code: "P0001", message: "something_new" })).toEqual({ message: GENERIC_ERROR });
    expect(rpcErrorMessage(null)).toEqual({ message: GENERIC_ERROR });
  });
});

describe("suggestSlug", () => {
  it("영문 이름은 소문자·하이픈 URL로 바꾼다", () => {
    expect(suggestSlug("Acme Studio")).toBe("acme-studio");
    expect(suggestSlug("  My--Team 2026! ")).toBe("my-team-2026");
  });

  it("형식에 맞지 않으면 빈 값이다", () => {
    expect(suggestSlug("한빛 스튜디오")).toBe("");
    expect(suggestSlug("a")).toBe("");
  });

  it("결과는 항상 slug 규칙을 지키고 39자를 넘지 않는다", () => {
    const s = suggestSlug("x".repeat(60));
    expect(s.length).toBe(39);
    expect(SLUG_RE.test(s)).toBe(true);
  });
});

describe("isRecoverySession", () => {
  const now = 1_800_000_000;

  it("재설정 링크로 만든 세션은 유효 시간 안에서만 통과한다", () => {
    expect(isRecoverySession({ amr: [{ method: "recovery", timestamp: now - 60 }] }, now)).toBe(true);
    expect(isRecoverySession({ amr: [{ method: "recovery", timestamp: now - RECOVERY_WINDOW_SEC - 1 }] }, now)).toBe(false);
  });

  it("일반 로그인·가입 확인 세션과 클레임 없음은 거부한다", () => {
    expect(isRecoverySession({ amr: [{ method: "password", timestamp: now }] }, now)).toBe(false);
    expect(isRecoverySession({ amr: [{ method: "email/signup", timestamp: now }] }, now)).toBe(false);
    expect(isRecoverySession({ amr: [{ method: "mfa/recovery_code", timestamp: now }] }, now)).toBe(false);
    expect(isRecoverySession({ amr: ["recovery"] }, now)).toBe(false);
    expect(isRecoverySession(null, now)).toBe(false);
  });
});
