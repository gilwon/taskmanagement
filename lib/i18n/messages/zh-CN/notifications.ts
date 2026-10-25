// 알림·수신함 중국어 간체 문구
import type { Messages } from "../types";

export default {
  line: {
    mention: "{actor} 在评论中提及了你",
    assign: "{actor} 给你分配了任务",
    comment: "{actor} 评论了你的任务",
    update: "{actor} {text}",
    stock: "“{text}”的库存已低于安全库存",
  },
  loadFailed: "无法加载通知。{error}",
  markedAllRead: "已将所有通知标为已读",
  markAllRead: "全部标为已读",
  unread: "未读",
  subtitle: "按日期查看此工作区的通知。",
  allCaughtUp: "全部处理完毕",
  noUnread: "没有未读通知。",
  emptyTitle: "暂无通知",
  emptyDescription: "提及、分配和评论会显示在这里。",
  inboxSubtitle: "提及、分配、评论和更新集中在这里。",
  inboxList: "收件箱",
  unreadOnly: "仅看未读",
  inboxEmpty: "暂无需要处理的新消息。",
  preview: "预览",
  backToList: "返回列表",
  openTask: "打开任务",
  openProject: "打开项目",
  openStock: "打开库存",
  reply: "回复",
  markUnread: "标为未读",
  targetGone: "该内容已被删除，或你没有访问权限。",
  pickHint: "在左侧选择一条通知即可在此查看。",
} satisfies Messages["notifications"];
