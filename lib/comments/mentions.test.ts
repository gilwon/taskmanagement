// 멘션 파싱·삽입·하이라이트 조각 테스트
import { describe, expect, it } from "vitest";
import { activeMention, filterMentionCandidates, insertMention, mentionIds, splitMentions } from "./mentions";

const members = [
  { id: "a", name: "김지" },
  { id: "b", name: "김지윤" },
  { id: "c", name: "Sarah Chen" },
];

describe("activeMention", () => {
  it("커서 앞의 @검색어를 찾는다", () => {
    expect(activeMention("안녕 @김", 5)).toEqual({ start: 3, query: "김" });
    expect(activeMention("@", 1)).toEqual({ start: 0, query: "" });
    expect(activeMention("줄\n@지", 4)).toEqual({ start: 2, query: "지" });
  });
  it("@ 앞이 공백이 아니거나 검색어에 공백이 있으면 없다", () => {
    expect(activeMention("a@b.com", 7)).toBeNull();
    expect(activeMention("@김 지", 4)).toBeNull();
    expect(activeMention("멘션 없음", 5)).toBeNull();
  });
  it("커서 뒤 글자는 보지 않는다", () => {
    expect(activeMention("@김지윤 다음", 2)).toEqual({ start: 0, query: "김" });
  });
});

describe("insertMention", () => {
  it("검색어를 @이름과 공백으로 바꾸고 커서를 뒤로 옮긴다", () => {
    expect(insertMention("안녕 @김 반가워", 3, 5, "김지윤")).toEqual({ text: "안녕 @김지윤  반가워", caret: 8 });
  });
});

describe("filterMentionCandidates", () => {
  it("이름에 검색어가 들어간 구성원을 대소문자 없이 고른다", () => {
    expect(filterMentionCandidates(members, "sar").map((m) => m.id)).toEqual(["c"]);
    expect(filterMentionCandidates(members, "").length).toBe(3);
    expect(filterMentionCandidates(members, "", 2).length).toBe(2);
  });
});

describe("splitMentions", () => {
  it("긴 이름을 먼저 맞춘다", () => {
    expect(splitMentions("@김지윤 확인 부탁", members)).toEqual([
      { text: "@김지윤", memberId: "b" },
      { text: " 확인 부탁" },
    ]);
  });
  it("공백이 든 이름과 여러 멘션을 나눈다", () => {
    expect(splitMentions("@Sarah Chen, @김지 님", members)).toEqual([
      { text: "@Sarah Chen", memberId: "c" },
      { text: ", " },
      { text: "@김지", memberId: "a" },
      { text: " 님" },
    ]);
  });
  it("이메일·모르는 이름·HTML은 일반 글로 둔다", () => {
    expect(splitMentions("a@김지윤 <script>@없음</script>", members)).toEqual([
      { text: "a@김지윤 <script>@없음</script>" },
    ]);
  });
  it("빈 본문은 빈 배열", () => {
    expect(splitMentions("", members)).toEqual([]);
  });
});

describe("멘션 경계", () => {
  const people = [
    { id: "ann", name: "Ann" },
    { id: "annabel", name: "Annabel" },
    { id: "kim", name: "김지윤" },
  ];
  it("라틴 이름 뒤에 글자가 이어지면 짧은 이름으로 잡지 않는다", () => {
    expect(mentionIds("@Annabel 확인", people)).toEqual(["annabel"]);
    expect(mentionIds("@Ann 확인", people)).toEqual(["ann"]);
    expect(mentionIds("@Annie 확인", people)).toEqual([]);
    expect(mentionIds("@Ann_x @Ann2", people)).toEqual([]);
  });
  it("한글 조사는 허용한다", () => {
    expect(splitMentions("@김지윤님께 전달", people)).toEqual([
      { text: "@김지윤", memberId: "kim" },
      { text: "님께 전달" },
    ]);
  });
  it("문장 끝과 문장부호 앞에서도 잡는다", () => {
    expect(mentionIds("부탁해요 @Ann", people)).toEqual(["ann"]);
    expect(mentionIds("부탁해요 @Ann.", people)).toEqual(["ann"]);
  });
  it("공백으로 이어진 연속 멘션을 모두 잡는다", () => {
    expect(mentionIds("@Ann @Annabel @김지윤", people)).toEqual(["ann", "annabel", "kim"]);
    // 붙여 쓴 두 번째 @는 앞이 공백이 아니라 멘션이 아니다
    expect(mentionIds("@Ann@Annabel", people)).toEqual(["ann"]);
  });
});

describe("mentionIds", () => {
  it("중복 없이 나온 순서대로 id를 돌려준다", () => {
    expect(mentionIds("@김지윤 @Sarah Chen @김지윤", members)).toEqual(["b", "c"]);
    expect(mentionIds("멘션 없음", members)).toEqual([]);
  });
});
