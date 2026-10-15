// 검색어 정리·LIKE 이스케이프·일치 구간·발췌 규칙을 확인한다
import { describe, expect, it } from "vitest";
import { containsQuery, escapeLike, excerpt, likePattern, normalizeQuery, SEARCH_MAX_LEN, splitHighlight } from "./text";

describe("normalizeQuery", () => {
  it("문자열이 아니면 빈 값", () => {
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery(42)).toBe("");
    expect(normalizeQuery(["a"])).toBe("");
  });

  it("앞뒤 공백을 지우고 연속 공백을 하나로", () => {
    expect(normalizeQuery("  고객   포털\t\n초안 ")).toBe("고객 포털 초안");
    expect(normalizeQuery("   ")).toBe("");
  });

  it("길이 상한으로 자른다", () => {
    expect(normalizeQuery("가".repeat(150))).toHaveLength(SEARCH_MAX_LEN);
  });
});

describe("escapeLike·likePattern", () => {
  it("역슬래시·%·_를 순서대로 이스케이프한다", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("\\%_")).toBe("\\\\\\%\\_");
  });

  it("PostgREST 구문 문자는 그대로 둔다", () => {
    expect(likePattern("a,b(c).d:e")).toBe("%a,b(c).d:e%");
  });

  it("*는 이스케이프되지 않은 한 글자 와일드카드로 바꾼다", () => {
    expect(likePattern("x*y")).toBe("%x_y%");
    expect(likePattern("50%*")).toBe("%50\\%_%");
  });
});

describe("containsQuery", () => {
  it("대소문자를 무시하고 문자 그대로 찾는다", () => {
    expect(containsQuery("Website Redesign", "redesign")).toBe(true);
    expect(containsQuery("고객 포털 개편", "포털")).toBe(true);
    expect(containsQuery("x*y 정리", "x*y")).toBe(true);
    expect(containsQuery("xzy 정리", "x*y")).toBe(false);
    expect(containsQuery("(초안) 검토", "(초안")).toBe(true);
  });

  it("빈 값·null은 false", () => {
    expect(containsQuery(null, "a")).toBe(false);
    expect(containsQuery("abc", "")).toBe(false);
  });
});

describe("splitHighlight", () => {
  it("q가 비면 통째로 hit=false", () => {
    expect(splitHighlight("작업 제목", "")).toEqual([{ text: "작업 제목", hit: false }]);
  });

  it("여러 번 나오는 구간을 원문 대소문자 그대로 나눈다", () => {
    expect(splitHighlight("API 문서와 api 키, Api", "api")).toEqual([
      { text: "API", hit: true },
      { text: " 문서와 ", hit: false },
      { text: "api", hit: true },
      { text: " 키, ", hit: false },
      { text: "Api", hit: true },
    ]);
  });

  it("특수문자를 정규식 없이 찾는다", () => {
    expect(splitHighlight("할인 50% 적용, 50%", "50%")).toEqual([
      { text: "할인 ", hit: false },
      { text: "50%", hit: true },
      { text: " 적용, ", hit: false },
      { text: "50%", hit: true },
    ]);
    expect(splitHighlight("a.b(c)", ".b(")).toEqual([
      { text: "a", hit: false },
      { text: ".b(", hit: true },
      { text: "c)", hit: false },
    ]);
  });

  it("일치가 없으면 통째로 hit=false", () => {
    expect(splitHighlight("고객 포털", "결제")).toEqual([{ text: "고객 포털", hit: false }]);
  });
});

describe("excerpt", () => {
  const long = `${"가".repeat(200)}검색어${"나".repeat(200)}`;

  it("짧은 본문은 공백만 줄여 그대로", () => {
    expect(excerpt("첫 줄\n\n둘째   줄", "줄")).toBe("첫 줄 둘째 줄");
  });

  it("q를 가운데 두고 양쪽에 말줄임표", () => {
    const e = excerpt(long, "검색어");
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
    expect(e).toContain("검색어");
    expect(e.replace(/…/g, "")).toHaveLength(120);
  });

  it("q가 맨 앞이면 앞쪽 말줄임표가 없다", () => {
    const e = excerpt(`검색어${"나".repeat(200)}`, "검색어");
    expect(e.startsWith("검색어")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
  });

  it("q가 맨 뒤면 뒤쪽 말줄임표가 없다", () => {
    const e = excerpt(`${"가".repeat(200)}검색어`, "검색어");
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("검색어")).toBe(true);
  });

  it("q가 없으면 앞부분", () => {
    expect(excerpt(long, "없음")).toBe(`${"가".repeat(120)}…`);
  });
});
