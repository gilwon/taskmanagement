// 작업 설명 HTML 정제 허용 목록을 고정한다(spec R13)
import { describe, expect, it } from "vitest";
import { sanitizeTaskHtml } from "@/lib/html/sanitize";

describe("sanitizeTaskHtml", () => {
  it("허용 태그는 그대로 둔다", () => {
    const html = "<h3>제목</h3><p><strong>굵게</strong> <b>b</b> <em>기울임</em> <i>i</i><br></p><ul><li>a</li></ul><ol><li>b</li></ol>";
    expect(sanitizeTaskHtml(html)).toBe(html.replace("<br>", "<br />"));
  });

  it("https 링크는 rel을 고정하고 target을 지운다", () => {
    expect(sanitizeTaskHtml('<a href="https://example.com/x?y=1" target="_blank" rel="opener">링크</a>')).toBe(
      '<a href="https://example.com/x?y=1" rel="noopener noreferrer nofollow">링크</a>',
    );
  });

  it.each([
    ["javascript:", '<a href="javascript:alert(1)">x</a>'],
    ["대소문자 섞인 javascript:", '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ["엔티티로 숨긴 javascript:", '<a href="java&#x73;cript:alert(1)">x</a>'],
    ["data:", '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
    ["http:", '<a href="http://example.com">x</a>'],
    ["프로토콜 상대", '<a href="//evil.example">x</a>'],
    ["상대 경로", '<a href="/settings">x</a>'],
  ])("%s 링크는 href를 지우고 글자만 남긴다", (_, html) => {
    const out = sanitizeTaskHtml(html);
    expect(out).toBe("<a>x</a>");
    expect(out).not.toMatch(/href/);
  });

  it("on* 속성과 style을 지운다", () => {
    expect(sanitizeTaskHtml('<p onclick="x()" style="color:red" onmouseover="y()">본문</p>')).toBe("<p>본문</p>");
  });

  it("img·iframe·svg·script·style은 버린다", () => {
    const out = sanitizeTaskHtml(
      '<p>a<img src=x onerror="alert(1)">b</p><iframe src="https://e.x"></iframe><svg onload="x()"></svg><script>alert(1)</script><style>p{}</style>',
    );
    expect(out).toBe("<p>ab</p>");
  });

  it("허용하지 않는 태그는 글자만 남긴다", () => {
    expect(sanitizeTaskHtml("<h1>큰 제목</h1><div><span>내용</span></div>")).toBe("큰 제목내용");
  });

  it("허용하지 않는 링크 뒤의 https 링크도 올바르게 닫힌다", () => {
    expect(sanitizeTaskHtml('<p><a href="javascript:x">a</a> <a href="https://x.y">b</a></p>')).toBe(
      '<p><a>a</a> <a href="https://x.y" rel="noopener noreferrer nofollow">b</a></p>',
    );
  });

  it("글자가 없는 블록은 지운다", () => {
    expect(sanitizeTaskHtml("<p>앞</p><p></p><p> <br> </p><p>&nbsp;</p><h3> </h3><p>뒤</p>")).toBe("<p>앞</p><p>뒤</p>");
    expect(sanitizeTaskHtml("<p><strong> </strong></p><p>a<br>b</p>")).toBe("<p>a<br />b</p>");
    expect(sanitizeTaskHtml("<ul>\n<li></li>\n<li> </li>\n</ul><ol><li>항목</li><li></li></ol>")).toBe("<ol><li>항목</li></ol>");
  });

  it("정제로 내용이 다 지워진 블록도 지운다", () => {
    expect(sanitizeTaskHtml("<p><script>alert(1)</script></p><p><img src=x></p>")).toBe("");
  });

  it("모두 비면 빈 문자열", () => {
    expect(sanitizeTaskHtml("<p></p>\n<p><br></p>\n<ul><li><p></p></li></ul>")).toBe("");
  });

  it("빈 값은 빈 문자열", () => {
    expect(sanitizeTaskHtml(null)).toBe("");
    expect(sanitizeTaskHtml("")).toBe("");
  });
});
