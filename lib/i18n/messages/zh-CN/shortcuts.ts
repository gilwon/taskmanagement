// 키보드 단축키 중국어 간체 문구
import type { Messages } from "../types";

export default {
  title: "键盘快捷键",
  dialogHint: "在输入框中输入时，单键快捷键不生效。",
  settingsHint: "光标位于文本框中时，单键快捷键不生效。",
  then: "然后",
  thenLabel: "{first} 然后 {second}",
  group: {
    general: "通用",
    create: "新建",
    navigate: "导航",
    task: "任务",
  },
  item: {
    palette: "打开或关闭命令面板",
    search: "搜索工作区",
    help: "显示键盘快捷键",
    theme: "切换深色模式",
    sidebar: "收起或展开侧边栏",
    escape: "关闭弹出层、对话框或抽屉，取消选择",
    submit: "提交对话框、发送评论",
    edit: "编辑已打开的任务（抽屉）",
    pickStatus: "在状态选择器中选择状态",
    reorder: "在列表或看板中调整顺序",
    moveColumn: "在看板列之间移动",
    taskMenu: "打开任务菜单（右键菜单）",
    select: "在列表或看板中选择任务",
  },
  copied: "已复制{what}",
  copyFailed: "无法复制{what}。",
} satisfies Messages["shortcuts"];
