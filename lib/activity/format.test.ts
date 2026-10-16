// 활동 문장 변환 테스트. 모든 verb가 영어 없이 한국어 문장이 되는지, 조사와 extra 값 변환이 맞는지 본다
import { describe, expect, it } from "vitest";
import { createFormatter } from "@/lib/i18n/format";
import en from "@/lib/i18n/messages/en";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT } from "@/lib/i18n/t";
import { ACTIVITY_VERBS, activityText, directionJosa, formatActivity, objectJosa, type ActivityInput } from "./format";

const MEMBERS: Record<string, string> = { "u-taeo": "강태오" };

function input(verb: string, extra: unknown = {}, over: Partial<ActivityInput> = {}): ActivityInput {
  return {
    verb,
    extra,
    actorName: "김지윤",
    taskTitle: "홈페이지 시안",
    hasTask: true,
    projectName: "웹사이트 리디자인",
    memberName: (id) => MEMBERS[id],
    ...over,
  };
}

// verb마다 트리거가 넣는 대표 extra와 기대 문장
const CASES: Record<(typeof ACTIVITY_VERBS)[number], [unknown, string, Partial<ActivityInput>?]> = {
  moved: [{ from: "progress", to: "review" }, "김지윤님이 홈페이지 시안을 검토 중으로 옮겼습니다"],
  completed: [{ from: "review", to: "done" }, "김지윤님이 홈페이지 시안을 완료했습니다"],
  "commented on": [{ comment_id: "c1" }, "김지윤님이 홈페이지 시안에 댓글을 남겼습니다"],
  "changed priority of": [{ from: "high", to: "urgent" }, "김지윤님이 홈페이지 시안의 우선순위를 긴급으로 바꿨습니다"],
  "added a file to": [{ file_id: "f1", name: "시안_v3.fig" }, "김지윤님이 홈페이지 시안에 파일 “시안_v3.fig”를 추가했습니다"],
  created: [{}, "김지윤님이 홈페이지 시안을 만들었습니다"],
  assigned: [{ from: null, to: "u-taeo" }, "김지윤님이 홈페이지 시안을 강태오님에게 배정했습니다"],
  "created project": [{}, "김지윤님이 프로젝트 웹사이트 리디자인을 만들었습니다", { taskTitle: null, hasTask: false }],
  "changed due date of": [{ from: "2026-10-14", to: "2026-10-12" }, "김지윤님이 홈페이지 시안의 기한을 10월 12일로 바꿨습니다"],
  "changed start date of": [{ from: null, to: "2026-11-03" }, "김지윤님이 홈페이지 시안의 시작일을 11월 3일로 바꿨습니다"],
  "updated labels on": [{ from: ["bug"], to: ["bug", "qa"] }, "김지윤님이 홈페이지 시안의 라벨을 버그, 품질 검증으로 바꿨습니다"],
  renamed: [{ from: "시안", to: "홈페이지 시안" }, "김지윤님이 홈페이지 시안의 제목을 바꿨습니다"],
  "set repeat on": [{ to: "daily" }, "김지윤님이 홈페이지 시안을 매일 반복하도록 설정했습니다"],
  estimated: [{ to: "2h" }, "김지윤님이 홈페이지 시안의 예상 시간을 2시간으로 바꿨습니다"],
  "updated dependencies of": [{ added: "t2" }, "김지윤님이 홈페이지 시안에 선행 작업을 추가했습니다"],
  archived: [{}, "김지윤님이 홈페이지 시안을 보관했습니다"],
  restored: [{}, "김지윤님이 홈페이지 시안을 복원했습니다"],
  "completed subtask on": [{ subtask_id: "s1", title: "롤백 절차 확인" }, "김지윤님이 홈페이지 시안의 하위 작업 “롤백 절차 확인”을 완료했습니다"],
  "reopened subtask on": [{ subtask_id: "s1", title: "카피 검토" }, "김지윤님이 홈페이지 시안의 하위 작업 “카피 검토”를 다시 열었습니다"],
  "added subtask to": [{ subtask_id: "s1", title: "카피 검토" }, "김지윤님이 홈페이지 시안에 하위 작업 “카피 검토”를 추가했습니다"],
  "removed a file from": [{ file_id: "f1", name: "메모.pdf" }, "김지윤님이 홈페이지 시안에서 파일 “메모.pdf”를 삭제했습니다"],
  "assigned a subtask on": [
    { subtask_id: "s1", title: "카피 검토", to: "u-taeo" },
    "김지윤님이 홈페이지 시안의 하위 작업 “카피 검토”를 강태오님에게 배정했습니다",
  ],
  "set a subtask due date on": [
    { subtask_id: "s1", title: "카피 검토", to: "2026-10-20" },
    "김지윤님이 홈페이지 시안의 하위 작업 “카피 검토” 기한을 10월 20일로 바꿨습니다",
  ],
  "converted a subtask of": [
    { subtask_title: "카피 검토", new_task_id: "t9", new_task_key: "WEB-201" },
    "김지윤님이 홈페이지 시안의 하위 작업 “카피 검토”를 작업 WEB-201로 바꿨습니다",
  ],
  "changed status of project": [
    { from: "active", to: "risk" },
    "김지윤님이 프로젝트 웹사이트 리디자인의 상태를 위험으로 바꿨습니다",
    { taskTitle: null, hasTask: false },
  ],
};

describe("formatActivity", () => {
  it.each(ACTIVITY_VERBS)("%s", (verb) => {
    const [extra, expected, over] = CASES[verb];
    expect(activityText(input(verb, extra, over))).toBe(expected);
  });

  it("어떤 verb도 영어 단어를 보이지 않는다", () => {
    for (const verb of ACTIVITY_VERBS) {
      const [extra, , over] = CASES[verb];
      // 파일 이름·작업 키 같은 사용자 값은 영문일 수 있어 verb 문자열만 본다
      expect(activityText(input(verb, extra, over))).not.toContain(verb);
      // extra가 비면 사용자 값이 없으니 영문이 하나도 없어야 한다
      expect(activityText(input(verb, {}, over))).not.toMatch(/[A-Za-z]{3,}/);
    }
    expect(activityText(input("unknown verb"))).toBe("김지윤님이 홈페이지 시안을 바꿨습니다");
  });

  it("작업 제목만 굵게 표시한다", () => {
    const parts = formatActivity(input("moved", { to: "review" }));
    expect(parts.filter((p) => p.strong).map((p) => p.text)).toEqual(["홈페이지 시안"]);
    const project = formatActivity(input("created project", {}, { taskTitle: null, hasTask: false }));
    expect(project.filter((p) => p.strong).map((p) => p.text)).toEqual(["웹사이트 리디자인"]);
  });

  it("값을 지운 경우와 담당자 해제", () => {
    expect(activityText(input("changed due date of", { to: null }))).toBe("김지윤님이 홈페이지 시안의 기한을 지웠습니다");
    expect(activityText(input("estimated", { to: null }))).toBe("김지윤님이 홈페이지 시안의 예상 시간을 지웠습니다");
    expect(activityText(input("updated labels on", { to: [] }))).toBe("김지윤님이 홈페이지 시안의 라벨을 모두 지웠습니다");
    expect(activityText(input("assigned", { to: null }))).toBe("김지윤님이 홈페이지 시안의 담당자를 해제했습니다");
    expect(activityText(input("set repeat on", { to: "none" }))).toBe("김지윤님이 홈페이지 시안의 반복을 껐습니다");
    expect(activityText(input("updated dependencies of", { removed: "t2" }))).toBe(
      "김지윤님이 홈페이지 시안에서 선행 작업을 뺐습니다",
    );
  });

  it("작업 활동과 프로젝트 활동을 task 유무로 가른다", () => {
    const proj = { taskTitle: null, hasTask: false };
    expect(activityText(input("archived", {}, proj))).toBe("김지윤님이 프로젝트 웹사이트 리디자인을 보관했습니다");
    expect(activityText(input("restored", {}, proj))).toBe("김지윤님이 프로젝트 웹사이트 리디자인을 복원했습니다");
    expect(activityText(input("added a file to", { name: "로고.png" }, proj))).toBe(
      "김지윤님이 프로젝트 웹사이트 리디자인에 파일 “로고.png”를 추가했습니다",
    );
  });

  it("삭제된 작업·알 수 없는 사람·이름을 바꾼 작업", () => {
    expect(activityText(input("completed", {}, { taskTitle: null }))).toBe("김지윤님이 삭제된 작업을 완료했습니다");
    expect(activityText(input("created", {}, { actorName: null }))).toBe("알 수 없는 사용자가 홈페이지 시안을 만들었습니다");
    expect(activityText(input("assigned", { to: "u-gone" }))).toBe("김지윤님이 홈페이지 시안을 알 수 없는 사용자님에게 배정했습니다");
    expect(activityText(input("renamed", { from: "시안", to: "새 이름" }))).toBe(
      "김지윤님이 홈페이지 시안의 제목을 “새 이름”으로 바꿨습니다",
    );
  });
});

describe("formatActivity 영어", () => {
  const t = createT(en as Messages, "en");
  const f = createFormatter("en", { justNow: en.common.justNow });

  it("영어 틀로 같은 조각 구조를 만든다", () => {
    expect(formatActivity(input("moved", { to: "review" }, { actorName: "Jiyun", taskTitle: "Homepage" }), t, f)).toEqual([
      { text: "Jiyun moved " },
      { text: "Homepage", strong: true },
      { text: " to In review" },
    ]);
    for (const verb of ACTIVITY_VERBS) {
      // 사용자 값(파일 이름 등)은 한글일 수 있어 extra를 비운다
      const [, , over] = CASES[verb];
      expect(activityText(input(verb, {}, { ...over, actorName: "Jiyun", taskTitle: "Homepage", projectName: "Web" }), t, f)).not.toMatch(
        /[가-힣]/u,
      );
    }
  });
});

describe("조사", () => {
  it("을/를은 받침으로 고른다", () => {
    expect(objectJosa("작업")).toBe("을");
    expect(objectJosa("시안")).toBe("을");
    expect(objectJosa("리디자인")).toBe("을");
    expect(objectJosa("홈페이지")).toBe("를");
    expect(objectJosa("“카피 검토”")).toBe("를");
    expect(objectJosa("WEB-201")).toBe("을");
    expect(objectJosa("v2")).toBe("를");
    expect(objectJosa("Figma")).toBe("를");
    expect(objectJosa("API")).toBe("를");
    expect(objectJosa("HTML")).toBe("을");
  });

  it("으로/로는 ㄹ받침과 받침 없음에서 로", () => {
    expect(directionJosa("검토 중")).toBe("으로");
    expect(directionJosa("완료")).toBe("로");
    expect(directionJosa("할 일")).toBe("로");
    expect(directionJosa("백로그")).toBe("로");
    expect(directionJosa("10월 12일")).toBe("로");
    expect(directionJosa("2시간")).toBe("으로");
    expect(directionJosa("WEB-203")).toBe("으로");
    expect(directionJosa("WEB-207")).toBe("로");
  });
});
