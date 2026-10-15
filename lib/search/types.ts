// 검색 범위와 결과 타입. 검색 화면과 커맨드 팔레트가 함께 쓴다
import type { Enums } from "@/lib/database.types";

export const SEARCH_SCOPES = ["all", "tasks", "projects", "people", "files", "comments"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const SEARCH_LIMIT_DEFAULT = 20;
export const SEARCH_LIMIT_MAX = 50;

export type SearchResults = {
  tasks: {
    id: string;
    key: string;
    title: string;
    status: Enums<"task_status">;
    project: { key: string; name: string; color: string; icon: string };
  }[];
  projects: {
    id: string;
    key: string;
    name: string;
    color: string;
    icon: string;
    status: Enums<"project_status">;
    access: Enums<"project_access">;
  }[];
  people: { id: string; name: string; email: string; color: string; role: Enums<"ws_role"> }[];
  files: { id: string; name: string; type: Enums<"file_type">; project: { key: string; name: string }; taskKey: string | null }[];
  comments: { id: string; excerpt: string; taskKey: string; taskTitle: string; authorName: string; createdAt: string }[];
};

export function isSearchScope(v: unknown): v is SearchScope {
  return typeof v === "string" && (SEARCH_SCOPES as readonly string[]).includes(v);
}
