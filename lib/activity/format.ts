// 활동(activities) 한 건을 현재 로캘 문장 조각으로 바꾸는 순수 함수. 홈 최근 활동과 활동 화면이 함께 쓴다.
// 문장 틀은 사전(activity.verb)에 언어별로 하나씩 있고, 한국어 조사는 한국어 틀의 자리 표시자로만 넣는다
import {
  ESTIMATE_LABELS,
  PROJECT_STATUS_LABELS,
  REPEAT_LABELS,
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/i18n/labels";
import { createFormatter, type Formatter } from "@/lib/i18n/format";
import koActivity from "@/lib/i18n/messages/ko/activity";
import koCommon from "@/lib/i18n/messages/ko/common";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT, type Params, type T } from "@/lib/i18n/t";

// 한국어 기본값. 클라이언트 번들에 사전 전체가 실리지 않게 activity·common 영역만 담는다
const koT = createT({ activity: koActivity, common: koCommon } as unknown as Messages, "ko");
const koF = createFormatter("ko", { justNow: koCommon.justNow });

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

// 라벨 사전 값. 모르는 값은 원래 값을 그대로 보인다
function lookup(t: T, group: string, labels: Record<string, string>, value: string | null): string | null {
  if (!value) return null;
  return Object.hasOwn(labels, value) ? (t as (key: string) => string)(`common.${group}.${value}`) : value;
}

// DB date("YYYY-MM-DD")는 서울 달력 날짜다
function dateLabel(f: Formatter, value: string | null): string | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return null;
  return f.date(m[0]);
}

// “이름”. 따옴표 안 이름이 없으면 null
function quoted(value: string | null) {
  return value ? `“${value}”` : null;
}

// 굵은 대상 자리를 가르는 표시. 사용자 값에는 나오지 않는 제어 문자다
const SEP = "\u001f";

// ─────────────────────────────────────────────
// 문장
// ─────────────────────────────────────────────

// 활동 문장 조각. 예 [김지윤님이 ][작업 제목(굵게)][을 검토 중으로 옮겼습니다]
export function formatActivity(a: ActivityInput, t: T = koT, f: Formatter = koF): ActivitySegment[] {
  const actor = a.actorName ? t("activity.actor", { name: a.actorName }) : t("activity.unknownActor");
  const title = a.taskTitle ?? t("common.deletedTask");
  const x = a.extra;
  // 문장 틀 하나를 [대상 앞][굵은 대상][대상 뒤]로 나눈다. o는 대상의 을/를, 나머지 자리는 vars로 채운다
  const say = (key: string, target: string, vars: Params = {}): ActivitySegment[] => {
    const params = { actor, target: SEP, o: objectJosa(target), ...vars };
    const [before, after = ""] = (t as (key: string, params: Params) => string)(`activity.verb.${key}`, params).split(SEP);
    return [{ text: before }, { text: target, strong: true }, { text: after }];
  };
  const task = (key: string, vars?: Params) => say(key, title, vars);
  const project = (key: string, vars?: Params) => say(key, a.projectName, vars);
  // 값과 그 값의 으로/로
  const to = (value: string) => ({ to: value, ro: directionJosa(value) });
  // 값이 있으면 key, 없으면 key + "Cleared"
  const change = (key: string, value: string | null) => (value ? task(key, to(value)) : task(`${key}Cleared`));
  const subtask = quoted(text(x, "title")) ?? t("activity.subtask");
  const sub = { sub: subtask, subO: objectJosa(subtask) };
  const member = (id: string | null) => (id ? (a.memberName(id) ?? t("common.unknownUser")) : null);

  switch (a.verb as ActivityVerb) {
    case "created":
      return task("created");
    case "moved": {
      const status = lookup(t, "taskStatus", TASK_STATUS_LABELS, text(x, "to"));
      return status ? task("moved", to(status)) : task("movedNoTo");
    }
    case "completed":
      return task("completed");
    case "commented on":
      return task("commented");
    case "changed priority of":
      return change("priority", lookup(t, "taskPriority", TASK_PRIORITY_LABELS, text(x, "to")));
    case "added a file to": {
      const file = quoted(text(x, "name")) ?? t("activity.file");
      const vars = { file, fileO: objectJosa(file) };
      return a.hasTask ? task("fileAdded", vars) : project("projectFileAdded", vars);
    }
    case "removed a file from": {
      const file = quoted(text(x, "name")) ?? t("activity.file");
      const vars = { file, fileO: objectJosa(file) };
      return a.hasTask ? task("fileRemoved", vars) : project("projectFileRemoved", vars);
    }
    case "assigned": {
      const m = member(text(x, "to"));
      return m ? task("assigned", { member: m }) : task("unassigned");
    }
    case "created project":
      return project("projectCreated");
    case "changed due date of":
      return change("due", dateLabel(f, text(x, "to")));
    case "changed start date of":
      return change("start", dateLabel(f, text(x, "to")));
    case "updated labels on": {
      const value = field(x, "to");
      const names = Array.isArray(value) ? value.map((l) => lookup(t, "taskLabel", TASK_LABEL_LABELS, String(l))!) : [];
      return change("labels", names.length > 0 ? names.join(", ") : null);
    }
    case "renamed": {
      const value = text(x, "to");
      return value && value !== title ? task("renamed", { to: `“${value}”`, ro: directionJosa(value) }) : task("renamedNoTo");
    }
    case "set repeat on": {
      const value = text(x, "to");
      if (!value || value === "none") return task("repeatOff");
      return task("repeat", { repeat: lookup(t, "repeat", REPEAT_LABELS, value)! });
    }
    case "estimated":
      return change("estimate", lookup(t, "estimate", ESTIMATE_LABELS, text(x, "to")));
    case "updated dependencies of":
      return field(x, "removed") !== undefined ? task("depsRemoved") : task("depsAdded");
    case "archived":
      return a.hasTask ? task("archived") : project("projectArchived");
    case "restored":
      return a.hasTask ? task("restored") : project("projectRestored");
    case "completed subtask on":
      return task("subtaskCompleted", sub);
    case "reopened subtask on":
      return task("subtaskReopened", sub);
    case "added subtask to":
      return task("subtaskAdded", sub);
    case "assigned a subtask on":
      return task("subtaskAssigned", { ...sub, member: member(text(x, "to")) ?? t("common.unknownUser") });
    case "set a subtask due date on": {
      const date = dateLabel(f, text(x, "to"));
      return date ? task("subtaskDue", { ...sub, ...to(date) }) : task("subtaskDueCleared", sub);
    }
    case "converted a subtask of": {
      const converted = quoted(text(x, "subtask_title")) ?? t("activity.subtask");
      const vars = { sub: converted, subO: objectJosa(converted) };
      const key = text(x, "new_task_key");
      return key ? task("converted", { ...vars, ...to(key) }) : task("convertedNoKey", vars);
    }
    case "changed status of project": {
      const status = lookup(t, "projectStatus", PROJECT_STATUS_LABELS, text(x, "to"));
      return status ? project("projectStatus", to(status)) : project("projectStatusNoTo");
    }
    default:
      // check 제약 밖의 값은 오지 않는다. 와도 영어 verb를 그대로 보이지 않는다
      return a.hasTask ? task("fallback") : project("projectFallback");
  }
}

// 굵게 표시 없이 한 줄로. 접근성 이름·알림 문구용
export function activityText(a: ActivityInput, t?: T, f?: Formatter) {
  return formatActivity(a, t, f)
    .map((s) => s.text)
    .join("");
}
