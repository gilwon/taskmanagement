// 댓글 중국어 간체 문구
import type { Messages } from "../types";

export default {
  errors: {
    notFound: "找不到该评论。它可能已被删除，或你没有访问权限。",
    forbidden: "你没有操作此评论的权限。",
    conflict: "该评论在删除后已被修改，无法恢复。",
    invalidInput: "请输入评论内容。",
  },
  loadFailed: "无法加载评论。{error}",
  loading: "正在加载评论…",
  empty: "暂无评论",
  posted: "评论已发布",
  saved: "评论已更新",
  deleted: "评论已删除",
  undo: "撤销",
  restored: "评论已恢复",
  edited: "· 已编辑",
  menu: "{name} 的评论菜单",
  edit: "编辑",
  delete: "删除",
  editLabel: "编辑评论",
  inputLabel: "写评论",
  viewOnly: "你只有查看权限，无法评论。",
  placeholder: "写下评论… 输入 @ 可提及成员",
  send: "发送",
  mentionList: "可提及的成员",
  sendHint: "⌘/Ctrl+Enter 发送",
  reactionChip: "{emoji} 回应，{count} 人：{names}",
  reactionAdd: "添加回应",
  reaction: "{emoji} 回应",
} satisfies Messages["comments"];
