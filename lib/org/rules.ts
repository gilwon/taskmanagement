// 조직 화면 입력 규칙. 초대 이메일 파싱, 역할 변경 가능 범위, 알림 설정 키를 클라이언트와 Server Action이 함께 쓴다
import { EMAIL_RE } from "@/lib/auth/rules";
import type { Enums } from "@/lib/database.types";

export type Role = Enums<"ws_role">;

// 한 번에 보낼 수 있는 초대 수
export const MAX_INVITES = 20;

// 초대할 수 있는 역할. owner는 workspace_invites check 제약이 막는다
export const INVITE_ROLES = ["admin", "member", "guest"] as const satisfies readonly Role[];

// 앱 내 알림 종류. user_prefs.notif_prefs의 키이고 notification_type enum과 같다
export const NOTIF_KEYS = ["mention", "assign", "comment", "update"] as const satisfies readonly Enums<"notification_type">[];

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

// 역할별 권한 표(spec R8, DB 판정과 같은 내용). 값이 문자열이면 조건부로 가능하다는 설명이다.
// 화면에 보이기만 하고 판정에는 쓰지 않는다(판정은 DB 정책·함수가 한다)
export const ROLE_PERMISSIONS: { label: string; allow: Record<Role, boolean | string> }[] = [
  { label: "워크스페이스 이름·URL 변경", allow: { owner: true, admin: true, member: false, guest: false } },
  { label: "워크스페이스 삭제", allow: { owner: true, admin: false, member: false, guest: false } },
  { label: "구성원 초대·비활성화", allow: { owner: true, admin: "소유자 제외", member: false, guest: false } },
  { label: "역할 변경", allow: { owner: "자기 자신 제외", admin: "소유자 제외", member: false, guest: false } },
  { label: "팀 만들기·편집·삭제", allow: { owner: true, admin: true, member: false, guest: false } },
  { label: "프로젝트 만들기", allow: { owner: true, admin: true, member: true, guest: false } },
  { label: "모든 프로젝트 관리", allow: { owner: true, admin: true, member: false, guest: false } },
  { label: "공개 프로젝트 보기·편집", allow: { owner: true, admin: true, member: true, guest: false } },
  {
    label: "비공개 프로젝트",
    allow: { owner: true, admin: true, member: "추가된 프로젝트, 받은 권한만큼", guest: "추가된 프로젝트, 보기·댓글만" },
  },
];
