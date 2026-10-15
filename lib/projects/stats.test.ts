// 프로젝트 화면 순수 함수 테스트. 집계·필터·정렬·부하·키 미리보기
import { describe, expect, it } from "vitest";
import { filterProjects, lastActive, projectKeyPreview, sortProjects, taskStats, workload } from "@/lib/projects/stats";
import type { ProjectFilter, ProjectSummary } from "@/lib/projects/types";

// 서울 2026-10-15 정오
const NOW = new Date("2026-10-15T03:00:00Z");

function project(over: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: "p",
    key: "P",
    name: "프로젝트",
    icon: "folder",
    color: "indigo",
    status: "active",
    access: "workspace",
    leadId: null,
    dueDate: null,
    archivedAt: null,
    lastActiveAt: "2026-10-01T00:00:00Z",
    memberIds: [],
    favorite: false,
    perm: "edit",
    stats: taskStats([], NOW),
    tasks: [],
    ...over,
  };
}

const ALL: ProjectFilter = { q: "", status: "all", mine: false, archived: false };

describe("taskStats", () => {
  it("상태별 개수·진행률·기한 지남을 센다", () => {
    const s = taskStats(
      [
        { status: "done", due_date: "2026-10-01" },
        { status: "todo", due_date: "2026-10-14" },
        { status: "progress", due_date: "2026-10-15" },
        { status: "review", due_date: null },
      ],
      NOW,
    );
    expect(s).toMatchObject({ total: 4, done: 1, open: 3, overdue: 1, pct: 25 });
    expect(s.byStatus).toEqual({ backlog: 0, todo: 1, progress: 1, review: 1, done: 1 });
  });

  it("작업이 없으면 진행률 0", () => {
    expect(taskStats([], NOW).pct).toBe(0);
  });

  it("서울 날짜 기준으로 오늘을 정한다(UTC 전날 밤이 서울 오늘)", () => {
    // UTC 10-14 20:00 = 서울 10-15 05:00. 10-14 기한은 지남
    const s = taskStats([{ status: "todo", due_date: "2026-10-14" }], new Date("2026-10-14T20:00:00Z"));
    expect(s.overdue).toBe(1);
  });
});

describe("lastActive", () => {
  it("프로젝트와 작업 중 늦은 시각", () => {
    expect(lastActive("2026-10-01T00:00:00Z", [{ updated_at: "2026-10-05T00:00:00Z" }])).toBe("2026-10-05T00:00:00Z");
    expect(lastActive("2026-10-09T00:00:00Z", [{ updated_at: "2026-10-05T00:00:00Z" }])).toBe("2026-10-09T00:00:00Z");
  });
});

describe("filterProjects", () => {
  const list = [
    project({ id: "a", key: "WEB", name: "웹사이트 개편", memberIds: ["me"] }),
    project({ id: "b", key: "MOB", name: "Mobile App", status: "risk", leadId: "me" }),
    project({ id: "c", key: "OLD", name: "지난 일", archivedAt: "2026-09-01T00:00:00Z" }),
    project({ id: "d", key: "MKT", name: "마케팅" }),
  ];
  const ids = (f: Partial<ProjectFilter>) => filterProjects(list, { ...ALL, ...f }, "me").map((p) => p.id);

  it("기본은 보관된 프로젝트를 뺀다", () => {
    expect(ids({})).toEqual(["a", "b", "d"]);
    expect(ids({ archived: true })).toEqual(["a", "b", "c", "d"]);
  });
  it("상태로 거른다", () => {
    expect(ids({ status: "risk" })).toEqual(["b"]);
  });
  it("내 프로젝트는 구성원이거나 리드", () => {
    expect(ids({ mine: true })).toEqual(["a", "b"]);
  });
  it("이름·키를 대소문자 없이 찾는다", () => {
    expect(ids({ q: "mob" })).toEqual(["b"]);
    expect(ids({ q: "web" })).toEqual(["a"]);
    expect(ids({ q: "개편" })).toEqual(["a"]);
  });
});

describe("sortProjects", () => {
  const list = [
    project({ id: "a", name: "나", dueDate: null, lastActiveAt: "2026-10-03T00:00:00Z", stats: { ...taskStats([], NOW), pct: 10 } }),
    project({ id: "b", name: "가", dueDate: "2026-11-01", lastActiveAt: "2026-10-05T00:00:00Z", stats: { ...taskStats([], NOW), pct: 80 } }),
    project({ id: "c", name: "다", dueDate: "2026-10-20", lastActiveAt: "2026-10-01T00:00:00Z", stats: { ...taskStats([], NOW), pct: 80 } }),
  ];
  const ids = (s: Parameters<typeof sortProjects>[1]) => sortProjects(list, s).map((p) => p.id);

  it("최근 활동 늦은 순", () => expect(ids("recent")).toEqual(["b", "a", "c"]));
  it("이름순", () => expect(ids("name")).toEqual(["b", "a", "c"]));
  it("기한 이른 순, 없음은 뒤", () => expect(ids("due")).toEqual(["c", "b", "a"]));
  it("진행률 높은 순, 같으면 이름순", () => expect(ids("progress")).toEqual(["b", "c", "a"]));
  it("원본 배열을 바꾸지 않는다", () => {
    sortProjects(list, "due");
    expect(list.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("workload", () => {
  it("담당자별 열린 작업 수, 많은 순", () => {
    expect(
      workload([
        { status: "todo", assignee_id: "x" },
        { status: "done", assignee_id: "x" },
        { status: "progress", assignee_id: "y" },
        { status: "review", assignee_id: "y" },
        { status: "todo", assignee_id: null },
      ]),
    ).toEqual([
      { userId: "y", open: 2 },
      { userId: "x", open: 1 },
    ]);
  });
});

describe("projectKeyPreview", () => {
  it("영문 단어 첫 글자를 최대 3자", () => {
    expect(projectKeyPreview("Website Redesign")).toBe("WR");
    expect(projectKeyPreview("  customer  portal project extra ")).toBe("CPP");
  });
  it("영문자로 시작하지 않는 단어는 건너뛴다", () => {
    expect(projectKeyPreview("2026 마케팅 Launch plan")).toBe("LP");
  });
  it("영문 단어가 없으면 P", () => {
    expect(projectKeyPreview("디자인 시스템")).toBe("P");
    expect(projectKeyPreview("")).toBe("P");
  });
});
