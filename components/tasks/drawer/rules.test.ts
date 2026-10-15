// 드로어·새 작업 모달 순수 규칙 테스트
import { describe, expect, it } from "vitest";
import { overdueDays, validLink } from "@/components/tasks/drawer/rules";
import { diffPatch, parseSubtaskLines, type Fields } from "@/components/tasks/new-task/rules";
import type { TaskItem } from "@/lib/tasks/types";

describe("validLink", () => {
  it("https 주소만 통과시킨다", () => {
    expect(validLink(" https://example.com/a?b=1 ")).toBe("https://example.com/a?b=1");
    expect(validLink("http://example.com")).toBeNull();
    expect(validLink("javascript:alert(1)")).toBeNull();
    expect(validLink("JaVaScRiPt:alert(1)")).toBeNull();
    expect(validLink("//example.com")).toBeNull();
    expect(validLink("https:///etc")).toBeNull();
    expect(validLink("https://exa mple.com")).toBeNull();
  });
});

describe("overdueDays", () => {
  // 2026-10-15 09:00 KST
  const now = new Date("2026-10-15T00:00:00Z");
  it("서울 날짜 기준으로 지난 날 수를 센다", () => {
    expect(overdueDays("2026-10-12", "todo", now)).toBe(3);
    expect(overdueDays("2026-10-15", "todo", now)).toBe(0);
    expect(overdueDays("2026-10-20", "todo", now)).toBe(0);
  });
  it("완료됐거나 기한이 없으면 0", () => {
    expect(overdueDays("2026-10-12", "done", now)).toBe(0);
    expect(overdueDays(null, "todo", now)).toBe(0);
  });
});

describe("parseSubtaskLines", () => {
  it("빈 줄을 버리고 앞뒤 공백을 지운다", () => {
    expect(parseSubtaskLines(" 하나 \n\n  \n둘\r\n")).toEqual(["하나", "둘"]);
  });
});

describe("diffPatch", () => {
  const task = {
    title: "제목",
    description_html: null,
    assignee_id: "a",
    priority: "medium",
    due_date: null,
    start_date: null,
    labels: ["bug"],
    recur: "none",
    status: "todo",
    project_id: "p",
  } as unknown as TaskItem;
  const same: Fields = {
    title: "제목",
    description: null,
    projectId: "p",
    status: "todo",
    assigneeId: "a",
    priority: "medium",
    due: null,
    start: null,
    labels: ["bug"],
    recur: "none",
    subtasks: "",
  };
  it("바뀐 값이 없으면 빈 patch", () => {
    expect(diffPatch(task, same)).toEqual({ patch: {}, status: null });
  });
  it("바뀐 값만 담고 상태는 따로 돌려준다", () => {
    expect(diffPatch(task, { ...same, title: " 새 제목 ", labels: [], status: "done", due: "2026-10-20" })).toEqual({
      patch: { title: "새 제목", labels: [], due: "2026-10-20" },
      status: "done",
    });
  });
});
