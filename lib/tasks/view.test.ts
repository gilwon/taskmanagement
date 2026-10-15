// 뷰 상태 적용(필터·검색·정렬·그룹)과 뷰 상태 파서를 고정한다
import { describe, expect, it } from "vitest";
import type { TaskItem, ViewState } from "@/lib/tasks/types";
import { DEFAULT_VIEW_STATE, applyView, dueBucket, isViewKey, parseViewState } from "@/lib/tasks/view";

// 서울 2026-10-15 12:00
const NOW = new Date("2026-10-15T03:00:00Z");
let seq = 0;

function mk(p: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `id-${seq}`,
    key: `WEB-${100 + seq}`,
    workspace_id: "ws",
    project_id: "p1",
    title: `작업 ${seq}`,
    status: "todo",
    priority: "medium",
    assignee_id: null,
    start_date: null,
    due_date: null,
    labels: [],
    description_html: null,
    estimate: null,
    sort_order: seq * 1000,
    recur: "none",
    recur_source_id: null,
    completed_at: null,
    prev_status: null,
    archived_at: null,
    deleted_at: null,
    created_by: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    assignee: null,
    project: { id: "p1", key: "WEB", name: "웹사이트", color: "indigo", icon: "globe" },
    subtaskDone: 0,
    subtaskTotal: 0,
    commentCount: 0,
    attachmentCount: 0,
    blockedBy: [],
    ...p,
  };
}

const view = (p: Partial<ViewState> = {}): ViewState => ({ ...parseViewState(null), ...p });
const keys = (groups: ReturnType<typeof applyView>) => groups.flatMap((g) => g.items.map((t) => t.title));

describe("dueBucket", () => {
  it("서울 날짜 기준으로 구간을 나눈다", () => {
    expect(dueBucket(null, NOW)).toBe("none");
    expect(dueBucket("2026-10-14", NOW)).toBe("overdue");
    expect(dueBucket("2026-10-15", NOW)).toBe("today");
    expect(dueBucket("2026-10-22", NOW)).toBe("next7");
    expect(dueBucket("2026-10-23", NOW)).toBe("later");
  });

  it("UTC로는 전날이어도 서울이 다음 날이면 그날이 오늘이다", () => {
    const lateUtc = new Date("2026-10-15T15:30:00Z"); // 서울 10월 16일 00:30
    expect(dueBucket("2026-10-16", lateUtc)).toBe("today");
    expect(dueBucket("2026-10-15", lateUtc)).toBe("overdue");
  });
});

describe("applyView 필터·검색", () => {
  const a = mk({ title: "디자인 시안", status: "progress", priority: "urgent", labels: ["design", "bug"], due_date: "2026-10-14" });
  const b = mk({ title: "API 연결", status: "done", assignee_id: "u1", assignee: { id: "u1", name: "이도현", color: "blue" }, due_date: "2026-10-15" });
  const c = mk({ title: "문서 정리", project_id: "p2", updated_at: "2026-10-15T01:00:00Z" });
  const items = [a, b, c];
  const run = (p: Partial<ViewState>) => keys(applyView(items, view({ group: "none", ...p }), { now: NOW }));

  it("is는 값 중 하나라도 맞으면, not은 하나도 맞지 않으면 남긴다", () => {
    expect(run({ filters: [{ f: "status", op: "is", v: ["progress", "done"] }] })).toEqual([a.title, b.title]);
    expect(run({ filters: [{ f: "status", op: "not", v: ["progress"] }] })).toEqual([b.title, c.title]);
  });

  it("라벨은 배열 중 하나라도 맞으면 is", () => {
    expect(run({ filters: [{ f: "labels", op: "is", v: ["bug"] }] })).toEqual([a.title]);
    expect(run({ filters: [{ f: "labels", op: "not", v: ["bug"] }] })).toEqual([b.title, c.title]);
  });

  it("담당자 none은 미지정", () => {
    expect(run({ filters: [{ f: "assignee", op: "is", v: ["none"] }] })).toEqual([a.title, c.title]);
  });

  it("기한·수정 시각 구간", () => {
    expect(run({ filters: [{ f: "due", op: "is", v: ["overdue"] }] })).toEqual([a.title]);
    expect(run({ filters: [{ f: "due", op: "is", v: ["none"] }] })).toEqual([c.title]);
    expect(run({ filters: [{ f: "updated", op: "is", v: ["24h"] }] })).toEqual([c.title]);
  });

  it("여러 필터는 모두 만족해야 하고 값이 빈 필터는 무시한다", () => {
    expect(
      run({ filters: [{ f: "project", op: "is", v: ["p1"] }, { f: "priority", op: "is", v: ["urgent"] }, { f: "labels", op: "is", v: [] }] }),
    ).toEqual([a.title]);
  });

  it("검색은 제목과 키를 대소문자 없이 본다", () => {
    expect(run({ q: "api" })).toEqual([b.title]);
    expect(run({ q: ` ${c.key.toLowerCase()} ` })).toEqual([c.title]);
  });

  it("완료 숨김", () => {
    expect(run({ showDone: false })).toEqual([a.title, c.title]);
  });
});

describe("applyView 정렬", () => {
  const items = [
    mk({ title: "나", priority: "low", due_date: "2026-10-20", sort_order: 3 }),
    mk({ title: "가", priority: "urgent", due_date: null, sort_order: 1 }),
    mk({ title: "다", priority: "none", due_date: "2026-10-16", sort_order: 2 }),
  ];
  const run = (f: ViewState["sort"]["f"], dir: 1 | -1) => keys(applyView(items, view({ group: "none", sort: { f, dir } }), { now: NOW }));

  it("수동은 sort_order", () => {
    expect(run("manual", 1)).toEqual(["가", "다", "나"]);
    expect(run("manual", -1)).toEqual(["나", "다", "가"]);
  });

  it("우선순위 오름차순은 긴급이 먼저", () => {
    expect(run("priority", 1)).toEqual(["가", "나", "다"]);
  });

  it("기한 없음은 방향과 무관하게 맨 뒤", () => {
    expect(run("due", 1)).toEqual(["다", "나", "가"]);
    expect(run("due", -1)).toEqual(["나", "다", "가"]);
  });

  it("제목은 한국어 순서", () => {
    expect(run("title", 1)).toEqual(["가", "나", "다"]);
  });
});

describe("applyView 그룹", () => {
  it("상태 그룹은 빈 묶음도 고정 순서로 돌려주고 완료 숨김이면 done을 뺀다", () => {
    const items = [mk({ status: "review" }), mk({ status: "todo" })];
    expect(applyView(items, view(), { now: NOW }).map((g) => [g.key, g.label, g.items.length])).toEqual([
      ["backlog", "백로그", 0],
      ["todo", "할 일", 1],
      ["progress", "진행 중", 0],
      ["review", "검토 중", 1],
      ["done", "완료", 0],
    ]);
    expect(applyView(items, view({ showDone: false }), { now: NOW }).map((g) => g.key)).not.toContain("done");
  });

  it("담당자 그룹은 이름순, 담당자 없음은 맨 뒤", () => {
    const items = [
      mk({ assignee_id: null }),
      mk({ assignee_id: "u2", assignee: { id: "u2", name: "최하은", color: "rose" } }),
      mk({ assignee_id: "u1", assignee: { id: "u1", name: "김지윤", color: "indigo" } }),
    ];
    expect(applyView(items, view({ group: "assignee" }), { now: NOW }).map((g) => g.label)).toEqual([
      "김지윤",
      "최하은",
      "담당자 없음",
    ]);
  });

  it("기한 그룹은 작업이 있는 구간만 구간 순서로", () => {
    const items = [mk({ due_date: "2026-11-30" }), mk({ due_date: "2026-10-10" })];
    expect(applyView(items, view({ group: "due" }), { now: NOW }).map((g) => g.key)).toEqual(["overdue", "later"]);
  });

  it("그룹 없음은 all 하나", () => {
    expect(applyView([], view({ group: "none" }), { now: NOW })).toEqual([{ key: "all", label: "모든 작업", items: [] }]);
  });
});

describe("parseViewState", () => {
  it("값이 없거나 객체가 아니면 기본값", () => {
    expect(parseViewState(null)).toEqual(DEFAULT_VIEW_STATE);
    expect(parseViewState("x")).toEqual(DEFAULT_VIEW_STATE);
    expect(parseViewState([])).toEqual(DEFAULT_VIEW_STATE);
  });

  it("기본값 객체를 공유하지 않는다", () => {
    const s = parseViewState(null);
    s.hidden.push("labels");
    expect(DEFAULT_VIEW_STATE.hidden).toEqual(["start", "created", "deps"]);
  });

  it("손상된 칸만 기본값으로 되돌린다", () => {
    expect(
      parseViewState({
        filters: [
          { f: "status", op: "not", v: ["done", 3, "done"] },
          { f: "nope", op: "is", v: [] },
          { f: "labels", v: "bug" },
          "x",
        ],
        sort: { f: "due", dir: -1 },
        group: "weird",
        q: 42,
        hidden: ["task", "labels", "labels", "zzz"],
        colW: { title: 300, due: 10, project: 5000, labels: "wide", status: 120.4 },
        showDone: "no",
      }),
    ).toEqual({
      filters: [
        { f: "status", op: "not", v: ["done"] },
        { f: "labels", op: "is", v: [] },
      ],
      sort: { f: "due", dir: -1 },
      group: "status",
      q: "",
      hidden: ["labels"],
      colW: { due: 64, project: 1200, status: 120 },
      showDone: true,
    });
  });

  it("정렬 방향은 -1이 아니면 1", () => {
    expect(parseViewState({ sort: { f: "title", dir: 0 } }).sort).toEqual({ f: "title", dir: 1 });
    expect(parseViewState({ sort: { f: "bad", dir: -1 } }).sort).toEqual({ f: "manual", dir: 1 });
  });
});

describe("isViewKey", () => {
  it("DB check 제약과 같은 형식만 받는다", () => {
    expect(isViewKey("tasks")).toBe(true);
    expect(isViewKey("p:3f8e2a10-1234-4abc-9def-0123456789ab")).toBe(true);
    expect(isViewKey("sv:3f8e2a10-1234-4abc-9def-0123456789ab")).toBe(true);
    expect(isViewKey("p:WEB")).toBe(false);
    expect(isViewKey("board")).toBe(false);
  });
});
