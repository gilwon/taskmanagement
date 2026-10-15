// 활동(activities) 한 건을 한국어 문장 조각으로 바꾸는 순수 함수. 홈 최근 활동과 활동 화면이 함께 쓴다
import {
  COLUMN_LABELS,
  DELETED_TASK_LABEL,
  ESTIMATE_LABELS,
  PROJECT_STATUS_LABELS,
  REPEAT_LABELS,
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNKNOWN_USER_LABEL,
} from "@/lib/i18n/labels";

// activities.verb check 제약과 같은 목록(마이그레이션 01). 트리거·RPC가 넣는 값은 이 안에만 있다
export const ACTIVITY_VERBS = [
  "moved",
  "completed",
  "commented on",
  "changed priority of",
  "added a file to",
  "created",
  "assigned",
  "created project",
  "changed due date of",
  "changed start date of",
  "updated labels on",
  "renamed",
  "set repeat on",
  "estimated",
  "updated dependencies of",
  "archived",
  "restored",
  "completed subtask on",
  "reopened subtask on",
  "added subtask to",
  "removed a file from",
  "assigned a subtask on",
  "set a subtask due date on",
  "converted a subtask of",
  "changed status of project",
] as const;
export type ActivityVerb = (typeof ACTIVITY_VERBS)[number];

// strong은 굵게 보일 대상 이름(작업 제목·프로젝트 이름)
export type ActivitySegment = { text: string; strong?: boolean };

export type ActivityInput = {
  verb: string;
  extra: unknown;
  // 프로필이 지워졌거나 볼 수 없으면 null
  actorName: string | null;
  // 작업이 영구 삭제됐거나 볼 수 없으면 null. task_id가 없는 프로젝트 활동도 null
  taskTitle: string | null;
  // task_id가 있던 활동인지. archived·restored가 작업 활동인지 프로젝트 활동인지 가른다
  hasTask: boolean;
  projectName: string;
  // extra.to에 든 사용자 id를 이름으로 바꾼다
  memberName: (id: string) => string | null | undefined;
};


// ─────────────────────────────────────────────
// 조사
// ─────────────────────────────────────────────

// 숫자를 읽을 때의 받침(영 일 이 삼 사 오 육 칠 팔 구)
const DIGIT_SOUND = ["other", "rieul", "none", "other", "none", "none", "other", "rieul", "rieul", "none"] as const;
// 알파벳 이름의 받침. 엘·엠·엔은 받침, 알(R)은 ㄹ받침
const LETTER_BATCHIM: Record<string, "rieul" | "other"> = { l: "rieul", r: "rieul", m: "other", n: "other" };

// 마지막 소리의 받침. none(없음), rieul(ㄹ), other(그 밖)
function finalSound(word: string): "none" | "rieul" | "other" {
  // 닫는 따옴표·괄호·공백은 건너뛰고 마지막 글자를 본다
  const ch = word.replace(/[\s"'”’)\]」』>.,!?]+$/u, "").slice(-1);
  if (!ch) return "none";
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return "none";
    return jong === 8 ? "rieul" : "other";
  }
  if (/\d/.test(ch)) return DIGIT_SOUND[Number(ch)];
  // 영문은 글자 이름으로 읽는다고 본다(Figma → 에이 → 를)
  return LETTER_BATCHIM[ch.toLowerCase()] ?? "none";
}

// 을/를
export function objectJosa(word: string) {
  return finalSound(word) === "none" ? "를" : "을";
}

// 으로/로. ㄹ받침과 받침 없음은 로
export function directionJosa(word: string) {
  return finalSound(word) === "other" ? "으로" : "로";
}

// ─────────────────────────────────────────────
// extra 값 읽기
// ─────────────────────────────────────────────

function field(extra: unknown, key: string): unknown {
  return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>)[key] : undefined;
}

function text(extra: unknown, key: string): string | null {
  const v = field(extra, key);
  return typeof v === "string" && v !== "" ? v : null;
}

function lookup<T extends Record<string, string>>(labels: T, value: string | null): string | null {
  if (!value) return null;
  return (labels as Record<string, string>)[value] ?? value;
}

// DB date("YYYY-MM-DD")는 서울 달력 날짜라 UTC로 읽어야 날이 밀리지 않는다
const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", month: "long", day: "numeric" });
function dateLabel(value: string | null): string | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return null;
  return dateFmt.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

// “이름”. 따옴표 안 이름이 없으면 null
function quoted(value: string | null) {
  return value ? `“${value}”` : null;
}

// ─────────────────────────────────────────────
// 문장
// ─────────────────────────────────────────────

// 활동 문장 조각. 예 [김지윤님이 ][작업 제목(굵게)][을 검토 중으로 옮겼습니다]
export function formatActivity(a: ActivityInput): ActivitySegment[] {
  const actor = a.actorName ? `${a.actorName}님이 ` : `${UNKNOWN_USER_LABEL}가 `;
  const title = a.taskTitle ?? DELETED_TASK_LABEL;
  const x = a.extra;
  const S = (t: string): ActivitySegment => ({ text: t, strong: true });
  const T = S(title);
  const P = S(a.projectName);
  // [행위자][굵은 대상][나머지 문장]
  const line = (target: ActivitySegment, rest: string): ActivitySegment[] => [{ text: actor }, target, { text: rest }];
  const obj = (target: ActivitySegment, rest: string) => line(target, `${objectJosa(target.text)} ${rest}`);
  // 프로젝트 활동. "프로젝트 "는 굵게 하지 않는다
  const project = (rest: string): ActivitySegment[] => [{ text: `${actor}프로젝트 ` }, P, { text: rest }];
  // "{대상}의 {속성}을 {값}(으)로 바꿨습니다". 값이 없으면 "{속성}을 지웠습니다"
  const change = (attr: string, value: string | null, cleared = `${attr}${objectJosa(attr)} 지웠습니다`) =>
    line(T, value ? `의 ${attr}${objectJosa(attr)} ${value}${directionJosa(value)} 바꿨습니다` : `의 ${cleared}`);
  const subtask = quoted(text(x, "title")) ?? "하위 작업";
  const member = (id: string | null) => (id ? (a.memberName(id) ?? UNKNOWN_USER_LABEL) : null);

  switch (a.verb as ActivityVerb) {
    case "created":
      return obj(T, "만들었습니다");
    case "moved": {
      const to = lookup(TASK_STATUS_LABELS, text(x, "to"));
      return to ? obj(T, `${to}${directionJosa(to)} 옮겼습니다`) : obj(T, "옮겼습니다");
    }
    case "completed":
      return obj(T, "완료했습니다");
    case "commented on":
      return line(T, "에 댓글을 남겼습니다");
    case "changed priority of":
      return change(COLUMN_LABELS.priority, lookup(TASK_PRIORITY_LABELS, text(x, "to")));
    case "added a file to": {
      const file = quoted(text(x, "name")) ?? "파일";
      if (!a.hasTask) return project(`에 파일 ${file}${objectJosa(file)} 추가했습니다`);
      return line(T, `에 파일 ${file}${objectJosa(file)} 추가했습니다`);
    }
    case "removed a file from": {
      const file = quoted(text(x, "name")) ?? "파일";
      if (!a.hasTask) return project(`에서 파일 ${file}${objectJosa(file)} 삭제했습니다`);
      return line(T, `에서 파일 ${file}${objectJosa(file)} 삭제했습니다`);
    }
    case "assigned": {
      const to = member(text(x, "to"));
      return to ? obj(T, `${to}님에게 배정했습니다`) : line(T, `의 ${COLUMN_LABELS.assignee}${objectJosa(COLUMN_LABELS.assignee)} 해제했습니다`);
    }
    case "created project":
      return project(`${objectJosa(a.projectName)} 만들었습니다`);
    case "changed due date of":
      return change(COLUMN_LABELS.due, dateLabel(text(x, "to")));
    case "changed start date of":
      return change(COLUMN_LABELS.start, dateLabel(text(x, "to")));
    case "updated labels on": {
      const to = field(x, "to");
      const names = Array.isArray(to) ? to.map((l) => lookup(TASK_LABEL_LABELS, String(l))!) : [];
      const attr = COLUMN_LABELS.labels;
      return change(attr, names.length > 0 ? names.join(", ") : null, `${attr}${objectJosa(attr)} 모두 지웠습니다`);
    }
    case "renamed": {
      const to = text(x, "to");
      return line(T, to && to !== title ? `의 제목을 “${to}”${directionJosa(to)} 바꿨습니다` : "의 제목을 바꿨습니다");
    }
    case "set repeat on": {
      const to = text(x, "to");
      if (!to || to === "none") return line(T, "의 반복을 껐습니다");
      return line(T, `${objectJosa(title)} ${lookup(REPEAT_LABELS, to)} 반복하도록 설정했습니다`);
    }
    case "estimated":
      return change(COLUMN_LABELS.estimate, lookup(ESTIMATE_LABELS, text(x, "to")));
    case "updated dependencies of":
      return field(x, "removed") !== undefined
        ? line(T, `에서 ${COLUMN_LABELS.deps}${objectJosa(COLUMN_LABELS.deps)} 뺐습니다`)
        : line(T, `에 ${COLUMN_LABELS.deps}${objectJosa(COLUMN_LABELS.deps)} 추가했습니다`);
    case "archived":
      return a.hasTask ? obj(T, "보관했습니다") : project(`${objectJosa(a.projectName)} 보관했습니다`);
    case "restored":
      return a.hasTask ? obj(T, "복원했습니다") : project(`${objectJosa(a.projectName)} 복원했습니다`);
    case "completed subtask on":
      return line(T, `의 하위 작업 ${subtask}${objectJosa(subtask)} 완료했습니다`);
    case "reopened subtask on":
      return line(T, `의 하위 작업 ${subtask}${objectJosa(subtask)} 다시 열었습니다`);
    case "added subtask to":
      return line(T, `에 하위 작업 ${subtask}${objectJosa(subtask)} 추가했습니다`);
    case "assigned a subtask on": {
      const to = member(text(x, "to")) ?? UNKNOWN_USER_LABEL;
      return line(T, `의 하위 작업 ${subtask}${objectJosa(subtask)} ${to}님에게 배정했습니다`);
    }
    case "set a subtask due date on": {
      const to = dateLabel(text(x, "to"));
      return line(
        T,
        to
          ? `의 하위 작업 ${subtask} ${COLUMN_LABELS.due}${objectJosa(COLUMN_LABELS.due)} ${to}${directionJosa(to)} 바꿨습니다`
          : `의 하위 작업 ${subtask} ${COLUMN_LABELS.due}${objectJosa(COLUMN_LABELS.due)} 지웠습니다`,
      );
    }
    case "converted a subtask of": {
      const sub = quoted(text(x, "subtask_title")) ?? "하위 작업";
      const key = text(x, "new_task_key");
      return line(
        T,
        key
          ? `의 하위 작업 ${sub}${objectJosa(sub)} 작업 ${key}${directionJosa(key)} 바꿨습니다`
          : `의 하위 작업 ${sub}${objectJosa(sub)} 작업으로 바꿨습니다`,
      );
    }
    case "changed status of project": {
      const to = lookup(PROJECT_STATUS_LABELS, text(x, "to"));
      return project(to ? `의 상태를 ${to}${directionJosa(to)} 바꿨습니다` : "의 상태를 바꿨습니다");
    }
    default:
      // check 제약 밖의 값은 오지 않는다. 와도 영어 verb를 그대로 보이지 않는다
      return a.hasTask ? obj(T, "바꿨습니다") : project(`${objectJosa(a.projectName)} 바꿨습니다`);
  }
}

// 굵게 표시 없이 한 줄로. 접근성 이름·알림 문구용
export function activityText(a: ActivityInput) {
  return formatActivity(a)
    .map((s) => s.text)
    .join("");
}
