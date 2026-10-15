// 보관함 행 동작 판정 테스트
import { describe, expect, it } from "vitest";
import { canPurge, canRestore, restoreMode } from "@/lib/projects/trash";

const DELETED = { deletedAt: "2026-10-15T00:00:00.123456+00:00", archivedAt: null };
const ARCHIVED = { deletedAt: null, archivedAt: "2026-10-14T00:00:00+00:00" };

describe("restoreMode", () => {
  it("삭제된 항목은 토큰 복원, 보관만 된 항목은 보관 해제", () => {
    expect(restoreMode(DELETED)).toBe("restore");
    expect(restoreMode(ARCHIVED)).toBe("unarchive");
    // 보관된 뒤 삭제된 항목도 휴지통 복원이 먼저다
    expect(restoreMode({ deletedAt: DELETED.deletedAt, archivedAt: ARCHIVED.archivedAt })).toBe("restore");
  });
});

describe("canPurge", () => {
  it("전체 권한이 아니면 언제나 거부", () => {
    for (const perm of ["view", "comment", "edit", null, undefined] as const) {
      expect(canPurge("task", DELETED, perm)).toBe(false);
      expect(canPurge("project", DELETED, perm)).toBe(false);
    }
  });
  it("삭제된 항목은 종류와 관계없이 영구 삭제할 수 있다", () => {
    for (const kind of ["project", "task", "comment", "file"] as const) {
      expect(canPurge(kind, DELETED, "full")).toBe(true);
    }
  });
  it("보관만 된 항목은 작업만 영구 삭제할 수 있다(purge_project는 소프트 삭제 상태만 받는다)", () => {
    expect(canPurge("task", ARCHIVED, "full")).toBe(true);
    expect(canPurge("project", ARCHIVED, "full")).toBe(false);
  });
});

describe("canRestore", () => {
  const ME = "me";
  it("보관 해제와 프로젝트 복원은 관리 권한만", () => {
    expect(canRestore("task", ARCHIVED, "edit", ME)).toBe(false);
    expect(canRestore("task", ARCHIVED, "full", ME)).toBe(true);
    expect(canRestore("project", DELETED, "edit", ME)).toBe(false);
    expect(canRestore("project", DELETED, "full", ME)).toBe(true);
  });
  it("작업·파일 복원은 편집 권한 이상", () => {
    expect(canRestore("task", DELETED, "comment", ME)).toBe(false);
    expect(canRestore("file", DELETED, "edit", ME)).toBe(true);
    expect(canRestore("file", DELETED, null, ME)).toBe(false);
  });
  it("댓글은 관리자이거나 작성자가 스스로 지운 경우만", () => {
    const own = { ...DELETED, authorId: ME, deletedBy: ME };
    expect(canRestore("comment", own, "comment", ME)).toBe(true);
    expect(canRestore("comment", own, "view", ME)).toBe(false);
    expect(canRestore("comment", { ...own, deletedBy: "admin" }, "edit", ME)).toBe(false);
    expect(canRestore("comment", { ...own, deletedBy: "admin" }, "full", ME)).toBe(true);
  });
});
