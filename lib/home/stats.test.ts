// 홈 집계 테스트. 서울 기준 주 시작, 기한 묶음, stat 값
import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/lib/tasks/types";
import { deadlineGroups, homeStats, myTaskBucket, myTaskTabs, projectProgress } from "./stats";

// 2026-10-15(목) 12:00 KST
const NOW = new Date("2026-10-15T03:00:00Z");

let seq = 0;
function task(over: Partial<TaskItem>): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    key: `WEB-${seq}`,
    title: `작업 ${seq}`,
    status: "todo",
    priority: "medium",
    assignee_id: "me",
    due_date: null,
    completed_at: null,
    sort_order: seq,
    project_id: "p1",
    ...over,
  } as TaskItem;
}

describe("homeStats", () => {
  it("열린 작업·내 담당·이번 주 완료·기한 지남", () => {
    const items = [
      task({ due_date: "2026-10-14" }),
      task({ due_date: "2026-10-15", assignee_id: "other" }),
      task({ status: "done", completed_at: "2026-10-12T00:30:00+09:00", due_date: "2026-10-01" }),
      task({ status: "done", completed_at: "2026-10-11T23:30:00+09:00" }),
      task({ due_date: "2026-10-10", assignee_id: null }),
    ];
    const projects = [{ status: "active" as const }, { status: "risk" as const }, { status: "hold" as const }];
    expect(homeStats(items, projects, "me", NOW)).toEqual({
      activeProjects: 2,
      riskProjects: 1,
      openTasks: 3,
      myOpenTasks: 1,
      doneThisWeek: 1,
      overdue: 2,
    });
  });
});

describe("묶음", () => {
  it("내 작업 탭과 내 작업 화면 묶음", () => {
    const items = [
      task({ due_date: "2026-10-20" }),
      task({ due_date: "2026-10-14" }),
      task({ due_date: "2026-10-15" }),
      task({}),
      task({ status: "done" }),
      task({ assignee_id: "other" }),
    ];
    const tabs = myTaskTabs(items, "me", NOW);
    expect(tabs.upcoming.map((t) => t.due_date)).toEqual(["2026-10-15", "2026-10-20", null]);
    expect(tabs.overdue).toHaveLength(1);
    expect(tabs.done).toHaveLength(1);
    expect(items.slice(0, 5).map((t) => myTaskBucket(t, NOW))).toEqual(["upcoming", "overdue", "today", "upcoming", "done"]);
  });

  // 10/15(목)~10/25(일) 하루씩, 완료·지난 작업 하나씩
  const spread = () => [
    ...["15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"].map((d) => task({ due_date: `2026-10-${d}` })),
    task({ due_date: "2026-10-17", status: "done" }),
    task({ due_date: "2026-10-14" }),
  ];
  const dues = (list: TaskItem[]) => list.map((t) => t.due_date!.slice(8));

  it("다가오는 마감 이번 주는 모레부터 이번 주 일요일까지, 완료 제외", () => {
    const g = deadlineGroups(spread(), NOW);
    expect([dues(g.today), dues(g.tomorrow), dues(g.week)]).toEqual([["15"], ["16"], ["17", "18"]]);
  });

  it("토요일이면 내일이 일요일이라 이번 주 묶음은 비어 있다", () => {
    const sat = new Date("2026-10-17T03:00:00Z");
    const g = deadlineGroups(spread(), sat);
    expect([dues(g.today), dues(g.tomorrow), dues(g.week)]).toEqual([["17"], ["18"], []]);
  });

  it("일요일이면 내일은 다음 주 월요일이고 이번 주 묶음은 비어 있다", () => {
    // 일요일 23시 KST
    const sun = new Date("2026-10-18T14:00:00Z");
    const g = deadlineGroups(spread(), sun);
    expect([dues(g.today), dues(g.tomorrow), dues(g.week)]).toEqual([["18"], ["19"], []]);
  });

  it("이번 주 완료는 서울 기준 월요일 0시부터", () => {
    const items = [
      task({ status: "done", completed_at: "2026-10-18T23:30:00+09:00" }),
      task({ status: "done", completed_at: "2026-10-19T00:10:00+09:00" }),
    ];
    // 일요일 23시 KST에는 둘 다 이번 주(10/12~), 월요일 0시 30분 KST부터는 월요일 완료만 이번 주(10/19~)
    expect(homeStats(items, [], "me", new Date("2026-10-18T14:00:00Z")).doneThisWeek).toBe(2);
    expect(homeStats(items, [], "me", new Date("2026-10-18T15:30:00Z")).doneThisWeek).toBe(1);
  });

  it("진행률은 프로젝트별 완료/전체", () => {
    const p = projectProgress([task({}), task({ status: "done" }), task({ project_id: "p2", assignee_id: null })]);
    expect(p.get("p1")).toMatchObject({ done: 1, total: 2 });
    expect([...p.get("p1")!.assignees]).toEqual(["me"]);
    expect(p.get("p2")?.assignees.size).toBe(0);
  });
});
