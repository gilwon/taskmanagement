// 사이드바 프로젝트 순서 계산(저장 순서 적용, 끌어 놓기 이동)을 고정한다
import { describe, expect, it } from "vitest";
import { moveId, orderProjects } from "@/lib/data/project-order";

const ps = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("orderProjects", () => {
  it("저장 순서대로 앞에, 나머지는 원래 순서로 뒤에", () => {
    expect(orderProjects(ps, ["c", "a"]).map((p) => p.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("저장 순서에 없어진 프로젝트 id는 무시한다", () => {
    expect(orderProjects(ps, ["x", "d"]).map((p) => p.id)).toEqual(["d", "a", "b", "c"]);
  });
  it("저장 순서가 비면 원래 순서", () => {
    expect(orderProjects(ps, []).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("moveId", () => {
  it("뺀 목록 기준 index에 넣는다", () => {
    expect(moveId(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveId(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
  });
  it("범위를 넘으면 끝·처음으로", () => {
    expect(moveId(["a", "b"], "a", 9)).toEqual(["b", "a"]);
    expect(moveId(["a", "b"], "b", -1)).toEqual(["b", "a"]);
  });
  it("없는 id는 그대로", () => {
    expect(moveId(["a"], "z", 0)).toEqual(["a"]);
  });
});
