// 전역 단축키 판정 순수 함수. 입력 중·IME 조합 중·대화상자·메뉴 포커스에서는 한 글자 단축키를 무시한다(META §6).
// 한글 자판에서는 e.key가 "ㅜ"처럼 바뀌므로 글자 키는 e.code(물리 키)로 맞춘다

export type KeyLike = {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

export type ShortcutAction = "palette" | "search" | "theme" | "newTask" | "newProject" | "help" | "sidebar" | "go";

// g 다음에 누르는 키와 이동할 화면(URL 첫 세그먼트)
export const GO_TARGETS = {
  KeyH: "home",
  KeyT: "my-tasks",
  KeyP: "projects",
  KeyI: "inbox",
  KeyC: "calendar",
  KeyS: "settings/general",
  KeyN: "notifications",
  KeyA: "activity",
  KeyM: "members",
  KeyV: "inventory",
} as const;
export type GoCode = keyof typeof GO_TARGETS;

// g를 누른 뒤 두 번째 키를 기다리는 시간
export const GO_WINDOW_MS = 1200;

// IME 조합 중인 키 입력. Safari는 조합 확정 키에 isComposing 대신 keyCode 229를 준다
export function isComposingKey(e: KeyLike) {
  return !!e.isComposing || e.keyCode === 229;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "time", "datetime-local", "month", "week"]);

// 글자를 입력받는 요소인지. 체크박스·버튼형 input은 입력으로 보지 않는다. 테스트에서 DOM 없이 쓰도록 필드만 본다
export function isTypingTarget(
  el: { tagName: string; type?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUT_TYPES.has(el.type ?? "text");
  return !!el.isContentEditable;
}

// 모달·드로어·메뉴·목록 상자 안에 포커스가 있는지. 그 안의 키는 그 부품이 처리한다
export function isInOverlay(el: Element | null): boolean {
  return !!el?.closest("[role=dialog], [role=alertdialog], [role=menu], [role=listbox]");
}

const mod = (e: KeyLike) => e.metaKey || e.ctrlKey;

// 조합 키 없이 누른 글자 키인지. 한글 자판에서도 맞도록 물리 키(code, 예 "KeyE")로 보고 IME 조합 중이면 무시한다
export function isPlainKey(e: KeyLike, code: string) {
  return !isComposingKey(e) && !mod(e) && !e.altKey && !e.shiftKey && e.code === code;
}

// 키 입력을 단축키 동작으로 바꾼다. 해당 없으면 null
export function matchShortcut(e: KeyLike, focus: { typing: boolean; overlay: boolean }): ShortcutAction | null {
  if (isComposingKey(e)) return null;
  // 조합 키 단축키는 입력 중에도 동작한다
  if (mod(e) && !e.altKey && e.code === "KeyK" && !e.shiftKey) return "palette";
  if (mod(e) && !e.altKey && e.code === "KeyL" && e.shiftKey) return "theme";
  if (mod(e) || e.altKey || focus.typing || focus.overlay) return null;
  // 미국식이 아닌 자판에서 ?·/·[의 물리 위치가 달라도 e.key로 한 번 더 맞춘다
  if ((e.code === "Slash" && e.shiftKey) || e.key === "?") return "help";
  if (e.shiftKey) return null;
  if (e.code === "Slash" || e.key === "/") return "search";
  if (e.code === "BracketLeft" || e.key === "[") return "sidebar";
  if (e.code === "KeyN") return "newTask";
  if (e.code === "KeyP") return "newProject";
  if (e.code === "KeyG") return "go";
  return null;
}

// g 다음 두 번째 키의 이동 대상. 조합 키·Shift·조합 중이면 null
export function matchGoTarget(e: KeyLike): GoCode | null {
  if (isComposingKey(e) || mod(e) || e.altKey || e.shiftKey) return null;
  return e.code in GO_TARGETS ? (e.code as GoCode) : null;
}
