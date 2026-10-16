// 키보드 단축키 영어 문구
import type { Messages } from "../types";

export default {
  title: "Keyboard shortcuts",
  dialogHint: "Single-key shortcuts don't work while you're typing in a field.",
  settingsHint: "Single-key shortcuts don't work while the cursor is in a text field.",
  then: "then",
  thenLabel: "{first} then {second}",
  group: {
    general: "General",
    create: "Create",
    navigate: "Navigation",
    task: "Tasks",
  },
  item: {
    palette: "Open or close command palette",
    search: "Search workspace",
    help: "Show keyboard shortcuts",
    theme: "Toggle dark mode",
    sidebar: "Collapse or expand sidebar",
    escape: "Close popover, dialog, or drawer; clear selection",
    submit: "Submit dialog, send comment",
    edit: "Edit open task (drawer)",
    nextPrevTask: "Next / previous task (drawer)",
    pickStatus: "Pick a status in the status picker",
    reorder: "Reorder in list or board",
    moveColumn: "Move between board columns",
    taskMenu: "Open task menu (context menu)",
    select: "Select task in list or board",
  },
  copied: "{what} copied",
  copyFailed: "{what} couldn't be copied.",
} satisfies Messages["shortcuts"];
