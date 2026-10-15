// 한국어 표시 사전. DB enum 값과 셸 메뉴의 한국어 표시명을 한곳에 모은다(META §0·§4)
import type { Enums } from "@/lib/database.types";

export const TASK_STATUS_LABELS: Record<Enums<"task_status">, string> = {
  backlog: "백로그",
  todo: "할 일",
  progress: "진행 중",
  review: "검토 중",
  done: "완료",
};

export const TASK_PRIORITY_LABELS: Record<Enums<"task_priority">, string> = {
  urgent: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
  none: "우선순위 없음",
};

// tasks.labels 배열의 허용 값(DB check 제약과 같은 목록)
export const TASK_LABEL_LABELS = {
  design: "디자인",
  frontend: "프론트엔드",
  backend: "백엔드",
  research: "리서치",
  content: "콘텐츠",
  bug: "버그",
  qa: "품질 검증",
  growth: "성장",
} as const;
export type TaskLabel = keyof typeof TASK_LABEL_LABELS;

export const PROJECT_STATUS_LABELS: Record<Enums<"project_status">, string> = {
  planning: "계획 중",
  active: "진행 중",
  risk: "위험",
  hold: "보류",
  complete: "완료",
};

// 프로젝트·구성원 색 이름과 META §4의 색상값. 구성원 색도 같은 이름을 쓴다
export const PROJECT_COLORS = {
  indigo: { label: "인디고", hex: "#5A67D8" },
  blue: { label: "파랑", hex: "#3B82C4" },
  violet: { label: "보라", hex: "#8662C9" },
  teal: { label: "청록", hex: "#23918A" },
  rose: { label: "장미", hex: "#C54B78" },
  amber: { label: "호박", hex: "#C48A1E" },
  green: { label: "초록", hex: "#3D8E5F" },
  slate: { label: "회색", hex: "#6B7280" },
} as const;
export type ProjectColor = keyof typeof PROJECT_COLORS;

// 알 수 없는 색 이름은 indigo로 본다
export function colorHex(name: string | null | undefined) {
  return (PROJECT_COLORS[name as ProjectColor] ?? PROJECT_COLORS.indigo).hex;
}

export const ROLE_LABELS: Record<Enums<"ws_role">, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "구성원",
  guest: "게스트",
};

export const MEMBER_STATUS_LABELS: Record<Enums<"member_status">, string> = {
  active: "활성",
  invited: "초대됨",
  deactivated: "비활성",
};

export const REPEAT_LABELS: Record<Enums<"repeat_kind">, string> = {
  none: "반복 안 함",
  daily: "매일",
  weekly: "매주",
  biweekly: "2주마다",
  monthly: "매월",
};

// tasks.estimate 허용 값. clear는 값이 아니라 "지우기" 메뉴 항목이다
export const ESTIMATE_LABELS = {
  "30m": "30분",
  "1h": "1시간",
  "2h": "2시간",
  "4h": "4시간",
  "1d": "1일",
  "2d": "2일",
  "3d": "3일",
  "5d": "5일",
  "8d": "8일",
  clear: "예상 시간 지우기",
} as const;

export const SHARE_PERM_LABELS: Record<Enums<"share_perm">, string> = {
  view: "보기 가능",
  comment: "댓글 가능",
  edit: "편집 가능",
  full: "전체 권한",
};

// workspace는 워크스페이스 이름이 들어가야 해서 함수로 둔다
export const GENERAL_ACCESS_LABELS: Record<Enums<"project_access">, (ws: string) => string> = {
  private: () => "초대된 사람만",
  workspace: (ws) => `${ws}의 모든 구성원`,
};

export const FILE_TYPE_LABELS: Record<Enums<"file_type">, string> = {
  fig: "Figma",
  pdf: "PDF",
  zip: "압축 파일",
  img: "이미지",
  sheet: "스프레드시트",
  doc: "문서",
  code: "코드",
  other: "파일",
};

export const NOTIFICATION_TYPE_LABELS: Record<Enums<"notification_type">, string> = {
  mention: "멘션",
  assign: "담당자 지정",
  comment: "댓글",
  update: "업데이트",
};

export const TEMPLATE_LABELS = {
  blank: "빈 프로젝트",
  product: "제품 개발",
  web: "웹사이트",
  mkt: "마케팅 캠페인",
  design: "디자인 프로젝트",
  software: "소프트웨어 개발",
  personal: "개인 프로젝트",
} as const;

// 반응 이모지는 번역 대상이 아니다. 접근성 이름만 한국어로 둔다
export const REACTION_LABELS = {
  "👍": "좋아요",
  "🎉": "축하",
  "❤️": "하트",
  "👀": "확인 중",
  "🚀": "로켓",
  "✅": "확인",
} as const;

// 셸 메뉴·화면 이름(META §0 메뉴 표). 문서 제목·브레드크럼·사이드바가 함께 쓴다
export const NAV_LABELS = {
  home: "홈",
  inbox: "수신함",
  myTasks: "내 작업",
  favorites: "즐겨찾기",
  notifications: "알림",
  workspace: "워크스페이스",
  projects: "프로젝트",
  overview: "개요",
  tasks: "작업",
  calendar: "캘린더",
  timeline: "타임라인",
  members: "구성원",
  activity: "활동",
  archive: "보관함",
  teams: "팀",
  board: "보드",
  list: "목록",
  table: "표",
  files: "파일",
  settings: "설정",
  help: "도움말 및 자료",
  more: "더 보기",
  search: "검색",
  newProject: "새 프로젝트",
  newTask: "새 작업",
  newTeam: "새 팀",
  inviteMember: "구성원 초대",
  profile: "프로필",
  signOut: "로그아웃",
  system: "디자인 시스템",
  states: "화면 상태",
} as const;

// 설정 화면 섹션. URL slug → 그룹·표시명. 미제공 항목은 동작하는 척하지 않는다(spec R23)
export const SETTINGS_SECTIONS = {
  general: { group: "일반", label: "워크스페이스" },
  appearance: { group: "일반", label: "화면 설정" },
  language: { group: "일반", label: "언어" },
  datetime: { group: "일반", label: "날짜 및 시간" },
  members: { group: "워크스페이스", label: "구성원" },
  teams: { group: "워크스페이스", label: "팀" },
  projects: { group: "워크스페이스", label: "프로젝트" },
  permissions: { group: "워크스페이스", label: "권한" },
  notifications: { group: "알림", label: "알림" },
  profile: { group: "개인", label: "프로필" },
  preferences: { group: "개인", label: "환경 설정" },
  shortcuts: { group: "개인", label: "키보드 단축키" },
  password: { group: "보안", label: "비밀번호" },
  sessions: { group: "보안", label: "로그인 세션" },
  "two-factor": { group: "보안", label: "2단계 인증", unavailable: true },
  billing: { group: "결제", label: "결제", unavailable: true },
} as const satisfies Record<string, { group: string; label: string; unavailable?: boolean }>;
export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

// 프로젝트 하위 탭. URL 세그먼트 → 표시명
export const PROJECT_TAB_LABELS = {
  overview: "개요",
  board: "보드",
  list: "목록",
  table: "표",
  calendar: "캘린더",
  timeline: "타임라인",
  files: "파일",
  activity: "활동",
} as const;
export type ProjectTab = keyof typeof PROJECT_TAB_LABELS;

// 작업 공통 툴바(META §3 공통 툴바). 필터·정렬·그룹·열의 표시명
export const FILTER_FIELD_LABELS = {
  status: "상태",
  assignee: "담당자",
  priority: "우선순위",
  due: "기한",
  project: "프로젝트",
  labels: "라벨",
  created: "생성일",
  updated: "수정일",
} as const;

export const SORT_FIELD_LABELS = {
  manual: "수동",
  priority: "우선순위",
  due: "기한",
  start: "시작일",
  title: "제목",
  status: "상태",
  assignee: "담당자",
  created: "생성일",
  updated: "최근 수정",
} as const;

export const GROUP_FIELD_LABELS = {
  status: "상태",
  priority: "우선순위",
  assignee: "담당자",
  project: "프로젝트",
  due: "기한",
  none: "그룹 없음",
} as const;

// 표 열 이름
export const COLUMN_LABELS = {
  task: "작업",
  status: "상태",
  priority: "우선순위",
  assignee: "담당자",
  due: "기한",
  start: "시작일",
  labels: "라벨",
  deps: "선행 작업",
  estimate: "예상 시간",
  created: "생성일",
  project: "프로젝트",
} as const;

// 기한 필터·그룹 구간(Asia/Seoul 기준)
export const DUE_BUCKET_LABELS = {
  overdue: "기한 지남",
  today: "오늘",
  next7: "7일 이내",
  later: "이후",
  none: "기한 없음",
} as const;

// 생성·수정 시각 필터 구간
export const DATE_RANGE_LABELS = {
  "24h": "최근 24시간",
  "7d": "최근 7일",
  "30d": "최근 30일",
} as const;

// 담당자 미지정 표시와 필터 값 "none"의 표시명
export const UNASSIGNED_LABEL = "담당자 없음";

// 구성원 목록에 없는 담당자(탈퇴·조회 범위 밖)의 표시명
export const UNKNOWN_USER_LABEL = "알 수 없는 사용자";

// 프로필 이름과 이메일이 모두 없는 구성원의 표시명
export const NAMELESS_MEMBER_LABEL = "이름 없음";

// 달력 요일 머리글. 일요일 시작
export const WEEKDAY_SHORT_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 홈 stat 카드 이름과 보조 문구
export const HOME_STAT_LABELS = {
  activeProjects: "진행 중 프로젝트",
  openTasks: "열린 작업",
  completed: "완료",
  overdue: "기한 지남",
} as const;
export const HOME_STAT_NOTES = {
  risk: (n: number) => `${n}개 위험`,
  mine: (n: number) => `${n}개 내 담당`,
  thisWeek: "이번 주",
  needAttention: "확인 필요",
  allOnTrack: "모두 순조로움",
} as const;

// 내 작업 묶음. 홈 내 작업 탭(예정·기한 지남·완료)과 내 작업 화면(기한 지남·오늘·예정·완료)이 함께 쓴다
export const MY_TASK_BUCKET_LABELS = {
  overdue: DUE_BUCKET_LABELS.overdue,
  today: DUE_BUCKET_LABELS.today,
  upcoming: "예정",
  done: TASK_STATUS_LABELS.done,
} as const;

// 홈 다가오는 마감 묶음
export const DEADLINE_GROUP_LABELS = {
  today: "오늘",
  tomorrow: "내일",
  week: "이번 주",
} as const;

// 홈 프로젝트 진행 표 열
export const PROJECT_PROGRESS_COLUMN_LABELS = {
  project: COLUMN_LABELS.project,
  status: COLUMN_LABELS.status,
  progress: "진행률",
  due: COLUMN_LABELS.due,
  team: "팀",
} as const;

// 영구 삭제됐거나 볼 수 없는 작업의 표시명(활동 문장 등)
export const DELETED_TASK_LABEL = "삭제된 작업";

// 파일 업로드 상태. ready만 완료로 보인다
export const FILE_STATUS_LABELS: Record<Enums<"file_status">, string> = {
  pending: "업로드 중",
  ready: "완료",
  failed: "업로드 실패",
};

// 프로젝트 파일 화면 정렬
export const FILE_SORT_LABELS = {
  newest: "최신순",
  name: "이름",
  type: "형식",
  size: "크기",
} as const;

// 프로젝트 파일 화면 보기 방식
export const FILE_VIEW_LABELS = {
  list: "목록",
  grid: "격자",
} as const;

// 댓글 반응 이모지. comment_reactions.emoji check 제약과 같은 값·순서다(❤️는 U+2764 U+FE0F)
export const REACTION_EMOJIS = ["👍", "🎉", "❤️", "👀", "🚀", "✅"] as const;

// 작업 상세 탭
export const DETAIL_TAB_LABELS = { comments: "댓글", activity: "활동", files: "파일" } as const;

// 활동 화면 종류 필터와 사람 필터의 전체 항목
export const ACTIVITY_KIND_LABELS = {
  all: "전체",
  status: "상태 변경",
  comments: "댓글",
  projects: "프로젝트",
} as const;
export const EVERYONE_LABEL = "모든 사람";

// 알림 날짜 묶음
export const NOTIFICATION_GROUP_LABELS = {
  today: "오늘",
  yesterday: "어제",
  week: "이번 주",
  earlier: "이전",
} as const;

// 알림 화면 탭(전체·읽지 않음)과 수신함 탭(전체 + 알림 종류)
export const NOTIFICATION_FILTER_LABELS = { all: "전체", unread: "읽지 않음" } as const;
export const INBOX_TAB_LABELS = { all: "전체", ...NOTIFICATION_TYPE_LABELS } as const;

// 파일 형식 필터의 모든 형식
export const FILE_TYPE_ALL_LABEL = "전체";

// 반응 툴팁 등에서 나 자신을 가리키는 이름
export const ME_LABEL = "나";

// 프로젝트 아이콘(DB check 제약과 같은 값·순서)과 선택지의 접근성 이름
export const PROJECT_ICON_LABELS = {
  globe: "지구본",
  smartphone: "스마트폰",
  megaphone: "확성기",
  rocket: "로켓",
  component: "컴포넌트",
  "building-2": "건물",
  "layout-grid": "격자",
  palette: "팔레트",
  code: "코드",
  briefcase: "서류 가방",
  target: "과녁",
  layers: "레이어",
  zap: "번개",
  heart: "하트",
  folder: "폴더",
  sparkles: "반짝임",
} as const;
export type ProjectIconName = keyof typeof PROJECT_ICON_LABELS;

// 프로젝트 목록 정렬과 보기 방식
export const PROJECT_SORT_LABELS = {
  recent: "최근 활동",
  name: "이름",
  due: "기한",
  progress: "진행률",
} as const;
export const PROJECT_VIEW_LABELS = { grid: "카드", list: "목록", table: "표" } as const;

// 프로젝트 목록·개요 표 열(META §3 Portfolio)
export const PROJECT_COLUMN_LABELS = {
  project: COLUMN_LABELS.project,
  lead: "리드",
  status: COLUMN_LABELS.status,
  progress: "진행률",
  open: "열린 작업",
  overdue: "기한 지남",
  due: COLUMN_LABELS.due,
  members: "구성원",
} as const;

// 워크스페이스 개요 stat 카드
export const OVERVIEW_STAT_LABELS = {
  projects: "프로젝트",
  tasks: "작업",
  completion: "완료율",
  members: "구성원",
} as const;

// 보관함 탭
export const ARCHIVE_TAB_LABELS = {
  projects: "프로젝트",
  tasks: "작업",
  comments: "댓글",
  files: "파일",
} as const;

// 보관함 항목 상태
export const ARCHIVE_STATE_LABELS = { deleted: "삭제됨", archived: "보관됨" } as const;

// 리드 미지정 표시
export const NO_LEAD_LABEL = "리드 없음";

// 검색 화면 탭(전체 + 결과 종류)
export const SEARCH_TAB_LABELS = {
  all: "전체",
  tasks: "작업",
  projects: "프로젝트",
  people: "사람",
  files: "파일",
  comments: "댓글",
} as const;

// 프로젝트·팀 아이콘 이름의 접근성 이름(META §4 아이콘 목록)
export const ICON_LABELS = {
  globe: "지구본",
  smartphone: "스마트폰",
  megaphone: "확성기",
  rocket: "로켓",
  component: "컴포넌트",
  "building-2": "건물",
  "layout-grid": "격자",
  palette: "팔레트",
  code: "코드",
  briefcase: "서류 가방",
  target: "과녁",
  layers: "레이어",
  zap: "번개",
  heart: "하트",
  folder: "폴더",
  sparkles: "반짝임",
} as const;

// 설정 화면의 "미제공" 표시(spec R23)
export const UNAVAILABLE_LABEL = "미제공";

// 화면 설정 값의 표시명(lib/prefs/prefs.ts PREF_OPTIONS)
export const PREF_LABELS = {
  theme: { light: "라이트", dark: "다크", system: "시스템 설정" },
  accent: { indigo: "인디고", blue: "파랑", violet: "보라", teal: "청록", rose: "장미", graphite: "흑연" },
  density: { comfortable: "기본", compact: "촘촘하게" },
  side: { comfortable: "기본", compact: "촘촘하게" },
  motion: { full: "켜기", reduce: "줄이기", system: "시스템 설정" },
} as const;

// 알림 설정의 알림 종류 설명
export const NOTIF_PREF_DESCRIPTIONS = {
  mention: "댓글에서 나를 멘션했을 때",
  assign: "작업 담당자로 지정되었을 때",
  comment: "내가 담당한 작업에 댓글이 달렸을 때",
  update: "내가 담당한 작업이 바뀌었을 때",
} as const;

// 즐겨찾기 화면 정렬
export const FAVORITE_SORT_LABELS = { recent: "최근 추가순", name: "이름순" } as const;
