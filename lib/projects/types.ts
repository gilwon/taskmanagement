// 프로젝트·개요·즐겨찾기·보관함 화면 공용 타입. 서버 조회 결과와 Server Action 입력 형태를 정의한다
import type { Enums } from "@/lib/database.types";
import type { TaskStatus } from "@/lib/tasks/types";

export type ProjectStatus = Enums<"project_status">;
export type SharePerm = Enums<"share_perm">;
export type ProjectAccess = Enums<"project_access">;

// 집계에 쓰는 작업 한 건(삭제·보관 제외)
export type TaskLite = {
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  updated_at: string;
};

export type TaskStats = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  // 완료/전체 백분율(정수). 작업이 없으면 0
  pct: number;
  byStatus: Record<TaskStatus, number>;
};

// 목록·개요의 프로젝트 한 줄
export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  status: ProjectStatus;
  access: ProjectAccess;
  leadId: string | null;
  dueDate: string | null;
  archivedAt: string | null;
  // 프로젝트나 그 작업이 마지막으로 바뀐 시각
  lastActiveAt: string;
  memberIds: string[];
  favorite: boolean;
  // 현재 사용자의 프로젝트 권한(project_perm)
  perm: SharePerm | null;
  stats: TaskStats;
  tasks: TaskLite[];
};

export type ProjectSort = "recent" | "name" | "due" | "progress";
export type ProjectFilter = {
  q: string;
  status: ProjectStatus | "all";
  mine: boolean;
  archived: boolean;
};

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  icon: string;
  color: string;
  access: ProjectAccess;
  leadId: string | null;
  description: string | null;
};

// 개요 탭에서 고칠 수 있는 값. 상태·기간·설명은 편집 권한, 리드·공개 범위는 관리 권한(DB guard_project_update)
export type ProjectPatch = Partial<{
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
  leadId: string | null;
  access: ProjectAccess;
}>;

export type Milestone = { id: string; name: string; date: string };

export type ProjectMemberRow = { userId: string; perm: SharePerm };

// 보관함 항목 종류
export type TrashKind = "project" | "task" | "comment" | "file";
