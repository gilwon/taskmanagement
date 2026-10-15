// 작업 설명 HTML 정제. 저장 시와 출력 시 둘 다 같은 허용 목록으로 거른다(spec R13)
import sanitizeHtml from "sanitize-html";

const EMPTY_BLOCK_TAGS = new Set(["p", "h3", "li", "ul", "ol"]);

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "h3", "a"],
  allowedAttributes: { a: ["href", "rel"] },
  // 링크는 https만. transformTags가 먼저 거르고 이 설정이 한 번 더 막는다
  allowedSchemes: ["https"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // 허용하지 않는 태그는 글자만 남기고, 스크립트·스타일은 내용까지 버린다
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  // 글자가 없는 블록(공백·<br>만 있거나 내용이 정제로 지워진 p·h3·li, 항목이 빠진 ul·ol)은 통째로 지운다.
  // frame.text는 자손 글자까지 포함하고 &nbsp;는 trim이 지운다
  exclusiveFilter: (frame) => EMPTY_BLOCK_TAGS.has(frame.tag) && frame.text.trim() === "",
  transformTags: {
    // https 링크만 남기고 target은 버리며 rel을 고정한다. 그 밖의 링크는 href 없는 <a>(누를 수 없는 글자)로 남긴다.
    // 태그 이름을 바꾸면 sanitize-html 2.18이 다음 </a>를 바뀐 이름으로 닫는 문제가 있어 이름은 그대로 둔다
    a: (tagName, attribs): sanitizeHtml.Tag => {
      const href = (attribs.href ?? "").trim();
      if (!/^https:\/\/[^\s/]/i.test(href)) return { tagName, attribs: {} };
      return { tagName, attribs: { href, rel: "noopener noreferrer nofollow" } };
    },
  },
};

export function sanitizeTaskHtml(html: string | null | undefined): string {
  if (!html) return "";
  // 지운 블록 사이에 남은 공백만 있으면 빈 문자열이 되도록 앞뒤 공백을 지운다
  return sanitizeHtml(html, OPTIONS).trim();
}
