// next 파라미터 검증과 공개 경로 판정을 검증한다
import { describe, expect, it } from "vitest";
import { isPublicPath, safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("같은 출처 상대 경로는 그대로 둔다", () => {
    expect(safeNext("/a/b?c=1")).toBe("/a/b?c=1");
    expect(safeNext("/")).toBe("/");
  });

  it("외부 URL과 프로토콜 상대 경로는 /로 바꾼다", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/\t/evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("값이 없으면 /로 바꾼다", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});

describe("isPublicPath", () => {
  it("인증 화면과 하위 경로는 공개다", () => {
    for (const p of ["/login", "/signup", "/verify", "/forgot", "/forgot/sent", "/reset/done", "/auth/confirm"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("비슷한 이름이나 앱 경로는 공개가 아니다", () => {
    for (const p of ["/", "/loginx", "/login/x", "/forgotten", "/authx", "/acme/home"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
