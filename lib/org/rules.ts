// 조직 화면 입력 규칙. 초대 이메일 파싱, 역할 변경 가능 범위, 알림 설정 키를 클라이언트와 Server Action이 함께 쓴다
import { EMAIL_RE } from "@/lib/auth/rules";
import type { Enums } from "@/lib/database.types";
import type { SettingsSection } from "@/lib/i18n/labels";

export type Role = Enums<"ws_role">;

// 한 번에 보낼 수 있는 초대 수
export const MAX_INVITES = 20;

// 초대할 수 있는 역할. owner는 workspace_invites check 제약이 막는다
export const INVITE_ROLES = ["admin", "member", "guest"] as const satisfies readonly Role[];

// 앱 내 알림 종류. user_prefs.notif_prefs의 키이고 notification_type enum과 같다
export const NOTIF_KEYS = ["mention", "assign", "comment", "update", "stock"] as const satisfies readonly Enums<"notification_type">[];

// 외부 발송 채널. notif_prefs에 알림 종류 키와 함께 저장되지만 종류가 아니라 DB(private.notify)는 보지 않는다
export const CHANNEL_KEYS = ["email", "push"] as const;
export const ALL_NOTIF_KEYS = [...NOTIF_KEYS, ...CHANNEL_KEYS] as const;
export type NotifPrefKey = (typeof ALL_NOTIF_KEYS)[number];

// 키별 기본값. 종류는 켜짐, 채널은 꺼짐(옵트인)이다. 값이 없거나 boolean이 아니면 기본값을 쓴다
export const NOTIF_PREF_DEFAULTS: Record<NotifPrefKey, boolean> = {
  mention: true,
  assign: true,
  comment: true,
  update: true,
  stock: true,
  email: false,
  push: false,
};

export function readNotifPrefs(raw: unknown): Record<NotifPrefKey, boolean> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    ALL_NOTIF_KEYS.map((k) => [k, typeof o[k] === "boolean" ? o[k] : NOTIF_PREF_DEFAULTS[k]]),
  ) as Record<NotifPrefKey, boolean>;
}

// saveNotifPrefs 입력 검증. 종류 5개와 채널 2개가 모두 boolean이어야 한다(저장은 jsonb 전체를 바꾼다). 모르는 키는 버린다
export function parseNotifPrefs(v: unknown): Record<NotifPrefKey, boolean> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!ALL_NOTIF_KEYS.every((k) => typeof o[k] === "boolean")) return null;
  return readNotifPrefs(o);
}

// 환경 설정(user_prefs). 시작 화면의 허용값과 작업 여는 방식. 컬럼 default_tab, task_open, show_done_board, confirm_del에 대응한다
export const START_TABS = ["home", "my-tasks", "projects", "inbox"] as const;
export type StartTab = (typeof START_TABS)[number];
export const TASK_OPEN_MODES = ["panel", "page"] as const;
export type TaskOpenMode = (typeof TASK_OPEN_MODES)[number];

export type UserPrefsView = { startTab: StartTab; taskOpen: TaskOpenMode; showDoneBoard: boolean; confirmDel: boolean };
export const DEFAULT_USER_PREFS: Readonly<UserPrefsView> = {
  startTab: "home",
  taskOpen: "panel",
  showDoneBoard: true,
  confirmDel: true,
};

// DB 값(null·손상 포함)을 허용값으로 바꾼다. 허용값이 아니면 기본값이다
export function parseStartTab(v: unknown): StartTab {
  return (START_TABS as readonly unknown[]).includes(v) ? (v as StartTab) : DEFAULT_USER_PREFS.startTab;
}
export function parseTaskOpen(v: unknown): TaskOpenMode {
  return (TASK_OPEN_MODES as readonly unknown[]).includes(v) ? (v as TaskOpenMode) : DEFAULT_USER_PREFS.taskOpen;
}

// 시작 화면 경로. /{ws}가 여기로 보낸다
export const startPath = (slug: string, tab: StartTab) => `/${slug}/${tab}`;

// savePrefs 입력 검증. 허용 키만, 키마다 허용값만 통과한다. 하나라도 어긋나거나 비어 있으면 null이다
export function parsePrefsPatch(v: unknown): Partial<UserPrefsView> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) return null;
  const out: Partial<UserPrefsView> = {};
  for (const k of keys) {
    const x = o[k];
    if (k === "startTab" && (START_TABS as readonly unknown[]).includes(x)) out.startTab = x as StartTab;
    else if (k === "taskOpen" && (TASK_OPEN_MODES as readonly unknown[]).includes(x)) out.taskOpen = x as TaskOpenMode;
    else if ((k === "showDoneBoard" || k === "confirmDel") && typeof x === "boolean") out[k] = x;
    else return null;
  }
  return out;
}

// 팀 아이콘. 프로젝트 아이콘과 같은 목록(META §4)이고 components/shell/project-icon.tsx가 그린다
export const TEAM_ICONS = [
  "globe", "smartphone", "megaphone", "rocket", "component", "building-2", "layout-grid", "palette",
  "code", "briefcase", "target", "layers", "zap", "heart", "folder", "sparkles",
] as const;

// 쉼표·세미콜론·공백·줄바꿈으로 나눈 이메일 목록. 소문자로 바꾸고 중복을 뺀다
export function parseInviteEmails(raw: string): { emails: string[]; invalid: string[] } {
  const parts = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  return { emails: parts.filter((e) => EMAIL_RE.test(e)), invalid: parts.filter((e) => !EMAIL_RE.test(e)) };
}

// 내가 남에게 줄 수 있는 역할 목록. 자기 자신, owner가 아닌 사람이 owner 행을 바꾸는 경우는 빈 목록이다.
// DB 트리거(guard_workspace_member)가 최종 판정하고 이 함수는 화면에서 고를 수 없는 값을 숨기는 데만 쓴다
export function assignableRoles(actor: Role | null, target: Role, isSelf: boolean): Role[] {
  if (isSelf || (actor !== "owner" && actor !== "admin")) return [];
  if (actor === "admin" && target === "owner") return [];
  return actor === "owner" ? ["owner", "admin", "member", "guest"] : ["admin", "member", "guest"];
}

export function isAdminRole(role: Role | null | undefined) {
  return role === "owner" || role === "admin";
}

// 역할 때문에 막는(403) 화면 판정. 볼 수 없는 데이터는 이 판정과 별개로 404로 숨긴다.
// 게스트는 구성원·팀·역할과 권한 화면을 열 수 없다. 소속이 아니면(null) 모두 막는다
export function canOpenOrgScreens(role: Role | null | undefined) {
  return role != null && role !== "guest";
}

// 게스트가 열 수 없는 설정 섹션. 위 조직 화면으로 가는 섹션과 같은 범위다.
// 관리자 전용 섹션은 없다. 일반(워크스페이스)은 소유자·관리자가 아니면 화면 안에서 읽기 전용으로 보인다
const GUEST_BLOCKED_SECTIONS: readonly SettingsSection[] = ["members", "teams", "permissions"];

export function canOpenSettingsSection(role: Role | null | undefined, section: SettingsSection) {
  return canOpenOrgScreens(role) || (role === "guest" && !GUEST_BLOCKED_SECTIONS.includes(section));
}

// 역할별 권한 표(spec R8, DB 판정과 같은 내용). id는 사전 키(org.permissions.row.<id>)다.
// 값이 문자열이면 조건부로 가능하다는 설명의 사전 키(org.permissions.cond.<값>)다.
// 화면에 보이기만 하고 판정에는 쓰지 않는다(판정은 DB 정책·함수가 한다)
export type PermissionCond = "exceptOwner" | "exceptSelf" | "addedGranted" | "addedViewComment";

export const ROLE_PERMISSIONS = [
  { id: "wsNameUrl", allow: { owner: true, admin: true, member: false, guest: false } },
  { id: "wsDelete", allow: { owner: true, admin: false, member: false, guest: false } },
  { id: "inviteDeactivate", allow: { owner: true, admin: "exceptOwner", member: false, guest: false } },
  { id: "changeRole", allow: { owner: "exceptSelf", admin: "exceptOwner", member: false, guest: false } },
  { id: "manageTeams", allow: { owner: true, admin: true, member: false, guest: false } },
  { id: "createProject", allow: { owner: true, admin: true, member: true, guest: false } },
  { id: "manageAllProjects", allow: { owner: true, admin: true, member: false, guest: false } },
  { id: "publicProjects", allow: { owner: true, admin: true, member: true, guest: false } },
  {
    id: "privateProjects",
    allow: { owner: true, admin: true, member: "addedGranted", guest: "addedViewComment" },
  },
  { id: "stockView", allow: { owner: true, admin: true, member: true, guest: false } },
  { id: "stockMove", allow: { owner: true, admin: true, member: true, guest: false } },
  { id: "stockManage", allow: { owner: true, admin: true, member: false, guest: false } },
  { id: "stockAdjust", allow: { owner: true, admin: true, member: false, guest: false } },
] as const satisfies readonly { id: string; allow: Record<Role, boolean | PermissionCond> }[];
