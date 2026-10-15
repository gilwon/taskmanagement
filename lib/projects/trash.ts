// 보관함 행 동작 판정 순수 함수. 복원 방식(토큰 복원·보관 해제)과 영구 삭제 가능 여부를 DB 규칙과 같게 정한다
import type { SharePerm, TrashKind } from "@/lib/projects/types";

export type TrashState = { deletedAt: string | null; archivedAt?: string | null };

// 삭제된 항목은 restore_*(토큰), 보관만 된 프로젝트·작업은 archived_at을 비운다
export function restoreMode(item: TrashState): "restore" | "unarchive" {
  return item.deletedAt !== null ? "restore" : "unarchive";
}

// 영구 삭제는 관리 권한(full)만. purge_project는 소프트 삭제된 프로젝트만 받고(보관만 된 프로젝트는 Storage 정리 경로가 없다),
// purge_task는 삭제 또는 보관된 작업을, purge_comment·purge_file은 삭제된 것만 받는다
export function canPurge(kind: TrashKind, item: TrashState, perm: SharePerm | null | undefined) {
  if (perm !== "full") return false;
  if (item.deletedAt !== null) return true;
  return kind === "task" && !!item.archivedAt;
}

const EDIT_PERMS: readonly (SharePerm | null | undefined)[] = ["edit", "full"];

// 복원·보관 해제 버튼을 보일지. DB 규칙과 같다.
// 보관 해제와 프로젝트 복원은 관리 권한, 작업·파일 복원은 편집 권한,
// 댓글 복원은 관리 권한이거나 작성자가 스스로 지운 댓글일 때(편집 권한 이상이면 댓글 권한도 있다)
export function canRestore(
  kind: TrashKind,
  item: TrashState & { authorId?: string | null; deletedBy?: string | null },
  perm: SharePerm | null | undefined,
  meId: string,
) {
  if (restoreMode(item) === "unarchive" || kind === "project") return perm === "full";
  if (kind === "comment") {
    if (perm === "full") return true;
    return perm !== null && perm !== undefined && perm !== "view" && item.authorId === meId && item.deletedBy === meId;
  }
  return EDIT_PERMS.includes(perm);
}
