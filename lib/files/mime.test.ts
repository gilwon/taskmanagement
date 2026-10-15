// 업로드 규칙 순수 함수 테스트. 크기 상한·허용 형식·객체 이름 규칙이 DB check·버킷 설정과 맞는지 고정한다
import { describe, expect, it } from "vitest";
import { checkUpload, formatSize, MAX_FILE_BYTES, normalizeName, ruleFor, toObjectName } from "@/lib/files/mime";

const OBJECT_RE = /^[A-Za-z0-9._-]{1,128}$/;

describe("checkUpload", () => {
  it("허용 확장자는 서버가 정한 MIME과 형식을 돌려준다", () => {
    const r = checkUpload("기획서 v2.PDF", 1000);
    expect(r).toMatchObject({ ok: true, name: "기획서 v2.PDF", mime: "application/pdf", type: "pdf" });
  });

  it("50 MB까지 받고 1바이트라도 넘으면 거부한다", () => {
    expect(checkUpload("a.png", MAX_FILE_BYTES).ok).toBe(true);
    expect(checkUpload("a.png", MAX_FILE_BYTES + 1).ok).toBe(false);
  });

  it("빈 파일과 정수가 아닌 크기는 거부한다", () => {
    expect(checkUpload("a.png", 0).ok).toBe(false);
    expect(checkUpload("a.png", 1.5).ok).toBe(false);
    expect(checkUpload("a.png", Number.NaN).ok).toBe(false);
  });

  it("SVG·실행 파일·HTML·확장자 없음은 거부한다", () => {
    for (const n of ["logo.svg", "setup.exe", "page.html", "README", ".png"]) {
      expect(checkUpload(n, 10).ok).toBe(false);
    }
  });

  it("시드가 쓰는 형식과 같다", () => {
    expect(ruleFor("a.md")).toEqual({ mime: "text/plain", type: "other" });
    expect(ruleFor("a.json")).toEqual({ mime: "application/json", type: "code" });
    expect(ruleFor("a.txt")).toEqual({ mime: "text/plain", type: "doc" });
    expect(ruleFor("a.fig")).toEqual({ mime: "application/x-figma", type: "fig" });
    expect(ruleFor("a.csv")).toEqual({ mime: "text/csv", type: "sheet" });
  });
});

describe("normalizeName", () => {
  it("슬래시·역슬래시·제어문자를 _로 바꾸고 앞뒤 공백을 지운다", () => {
    expect(normalizeName("  a/b\\c\u0001.txt ")).toBe("a_b_c_.txt");
  });

  it("빈 이름·점 이름·255자 초과는 거부한다", () => {
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName("..")).toBeNull();
    expect(normalizeName(`${"가".repeat(252)}.txt`)).toBeNull();
    expect(normalizeName(`${"가".repeat(251)}.txt`)).not.toBeNull();
  });
});

describe("toObjectName", () => {
  it("한글은 빼고 ASCII와 확장자만 남긴다", () => {
    expect(toObjectName("기획서 v2.pdf")).toBe("v2.pdf");
    expect(toObjectName("홈페이지_시안.fig")).toBe("file.fig");
    expect(toObjectName("hero banner (1).PNG")).toBe("hero_banner_1.png");
  });

  it("항상 DB check 형식을 지킨다", () => {
    for (const n of ["한글.pdf", "...", "a".repeat(300) + ".json", "x.제목", "-.-.txt"]) {
      expect(toObjectName(n)).toMatch(OBJECT_RE);
      expect(["..", "."]).not.toContain(toObjectName(n));
    }
  });
});

describe("formatSize", () => {
  it("B·KB·MB로 표기한다", () => {
    expect(formatSize(820)).toBe("820 B");
    expect(formatSize(12_595)).toBe("12.3 KB");
    expect(formatSize(2_516_582)).toBe("2.4 MB");
  });
});

describe("storageUploadMessage", () => {
  it("Storage 본문의 statusCode로 크기·형식 거부를 가린다", async () => {
    const { storageUploadMessage } = await import("@/lib/files/errors");
    expect(storageUploadMessage(400, '{"statusCode":"413","error":"Payload too large"}')).toContain("50 MB");
    expect(storageUploadMessage(400, '{"statusCode":"415","error":"invalid_mime_type"}')).toBe("지원하지 않는 형식입니다.");
    expect(storageUploadMessage(0)).toContain("네트워크");
    expect(storageUploadMessage(500, "<html>")).toContain("다시 시도");
  });
});
