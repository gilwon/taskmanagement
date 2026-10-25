// 키보드 단축키 목록(META §6). 단축키 모달과 설정의 키보드 단축키 화면이 함께 쓴다.
// keys의 "Mod"는 macOS에서 ⌘, 그 밖에서 Ctrl로 보인다. 연달아 누르는 키는 then으로 둔다
import type { Ko } from "@/lib/i18n/messages/types";

// title·label은 사전 키다. 화면에서 t로 바꾼다. 자리 표시자 없는 키로만 좁혀 t(키) 한 인자로 부를 수 있게 한다
type ItemKey = `shortcuts.item.${keyof Ko["shortcuts"]["item"]}` | `common.nav.${keyof Ko["common"]["nav"]}`;
export type ShortcutItem = { keys: string[]; then?: string[]; label: ItemKey };
export type ShortcutGroup = { title: `shortcuts.group.${keyof Ko["shortcuts"]["group"]}`; items: ShortcutItem[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "shortcuts.group.general",
    items: [
      { keys: ["Mod", "K"], label: "shortcuts.item.palette" },
      { keys: ["/"], label: "shortcuts.item.search" },
      { keys: ["?"], label: "shortcuts.item.help" },
      { keys: ["Mod", "Shift", "L"], label: "shortcuts.item.theme" },
      { keys: ["["], label: "shortcuts.item.sidebar" },
      { keys: ["Esc"], label: "shortcuts.item.escape" },
    ],
  },
  {
    title: "shortcuts.group.create",
    items: [
      { keys: ["N"], label: "common.nav.newTask" },
      { keys: ["P"], label: "common.nav.newProject" },
      { keys: ["Mod", "Enter"], label: "shortcuts.item.submit" },
    ],
  },
  {
    title: "shortcuts.group.navigate",
    items: [
      { keys: ["G"], then: ["H"], label: "common.nav.home" },
      { keys: ["G"], then: ["T"], label: "common.nav.myTasks" },
      { keys: ["G"], then: ["P"], label: "common.nav.projects" },
      { keys: ["G"], then: ["I"], label: "common.nav.inbox" },
      { keys: ["G"], then: ["C"], label: "common.nav.calendar" },
      { keys: ["G"], then: ["S"], label: "common.nav.settings" },
      { keys: ["G"], then: ["N"], label: "common.nav.notifications" },
      { keys: ["G"], then: ["A"], label: "common.nav.activity" },
      { keys: ["G"], then: ["M"], label: "common.nav.members" },
      { keys: ["G"], then: ["V"], label: "common.nav.inventory" },
    ],
  },
  {
    title: "shortcuts.group.task",
    items: [
      { keys: ["E"], label: "shortcuts.item.edit" },
      { keys: ["J / K"], label: "shortcuts.item.nextPrevTask" },
      { keys: ["1–5"], label: "shortcuts.item.pickStatus" },
      { keys: ["Alt", "↑↓"], label: "shortcuts.item.reorder" },
      { keys: ["Alt", "←→"], label: "shortcuts.item.moveColumn" },
      { keys: ["Shift", "F10"], label: "shortcuts.item.taskMenu" },
      { keys: ["Space"], label: "shortcuts.item.select" },
    ],
  },
];

// 단축키 표시 글자. Mod는 플랫폼에 따라 바꾼다
export function keyLabel(key: string, mac: boolean) {
  if (key === "Mod") return mac ? "⌘" : "Ctrl";
  if (key === "Shift") return mac ? "⇧" : "Shift";
  if (key === "Alt") return mac ? "⌥" : "Alt";
  if (key === "Enter") return "↵";
  return key;
}
