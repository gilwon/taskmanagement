// 반복 회차 알림 기준을 고정한다. 완료 전부터 있던 회차(다시 열었다가 다시 완료)는 next·created로 돌려주지 않는다
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/lib/tasks/types";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const NEXT_A = "00000000-0000-4000-8000-0000000000a1";
const NEXT_B = "00000000-0000-4000-8000-0000000000b1";
const NEXT_OF: Record<string, string> = { [A]: NEXT_A, [B]: NEXT_B };

// 완료 전부터 회차가 있는 원본 id. 테스트마다 정한다
let existing = new Set<string>();
const selectTaskItems = vi.fn();

vi.mock("server-only", () => ({}));
// 로캘은 쿠키·Accept-Language가 없어 기본값 ko로 정해진다
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));
vi.mock("@/lib/tasks/queries", () => ({ selectTaskItems: (...a: unknown[]) => selectTaskItems(...a), selectTaskDetail: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient() }));

// 체인 호출을 기록했다가 await 시점에 결과를 만든다
function fakeClient() {
  const query = (table: string) => {
    const state = { table, update: false, ins: {} as Record<string, string[]> };
    const chain = {
      select: () => chain,
      update: () => ((state.update = true), chain),
      is: () => chain,
      in: (col: string, ids: string[]) => ((state.ins[col] = ids), chain),
      then: (resolve: (v: unknown) => void) => {
        if (state.update) return resolve({ data: state.ins.id.map((id) => ({ id })), error: null });
        const sources = state.ins.recur_source_id.filter((id) => existing.has(id));
        resolve({ data: sources.map((id) => ({ recur_source_id: id })), error: null });
      },
    };
    return chain;
  };
  return {
    auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) },
    from: query,
    // 회차 생성은 기존 회차가 있어도 그 회차를 돌려준다(멱등)
    rpc: async (fn: string, args: { p_task: string }) =>
      fn === "complete_task" ? { data: [{ next_task_id: NEXT_OF[args.p_task] }], error: null } : { data: null, error: null },
  };
}

function item(id: string, source: string | null = null): TaskItem {
  return { id, recur_source_id: source } as TaskItem;
}

beforeEach(() => {
  existing = new Set();
  selectTaskItems.mockReset();
  selectTaskItems.mockImplementation(async (_s: unknown, where: { ids?: string[]; recurSourceIds?: string[] }) => ({
    items: where.ids
      ? where.ids.map((id) => item(id))
      : (where.recurSourceIds ?? []).map((id) => item(NEXT_OF[id], id)),
    error: null,
  }));
});

const { bulkUpdate, completeTask, moveTask } = await import("@/lib/tasks/actions");

describe("반복 회차 알림", () => {
  it("이번 완료로 생긴 회차는 next로 돌려준다", async () => {
    const r = await completeTask(A);
    expect(r.ok && r.data.next?.id).toBe(NEXT_A);
  });

  it("완료 전부터 있던 회차는 next를 비운다(완료·이동 모두)", async () => {
    existing = new Set([A]);
    const done = await completeTask(A);
    expect(done.ok && done.data).toMatchObject({ item: { id: A }, next: null });
    const moved = await moveTask(A, "done");
    expect(moved.ok && moved.data.next).toBeNull();
  });

  it("일괄 완료는 새로 생긴 회차만 created로 돌려준다", async () => {
    existing = new Set([A]);
    const r = await bulkUpdate([A, B], { status: "done" });
    expect(r.ok && r.data.created.map((t) => t.id)).toEqual([NEXT_B]);
    expect(selectTaskItems).toHaveBeenCalledWith(expect.anything(), { recurSourceIds: [B], includeArchived: true });
  });

  it("완료가 아닌 일괄 수정은 회차를 읽지 않는다", async () => {
    const r = await bulkUpdate([A, B], { priority: "high" });
    expect(r.ok && r.data.created).toEqual([]);
    expect(selectTaskItems).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recurSourceIds: expect.anything() }));
  });
});
