// 알림·수신함 영어 문구
import type { Messages } from "../types";

export default {
  line: {
    mention: "{actor} mentioned you in a comment",
    assign: "{actor} assigned you",
    comment: "{actor} commented on your task",
    update: "{actor} {text}",
    stock: "The stock of '{text}' fell below its safety level",
  },
  loadFailed: "Couldn't load notifications. {error}",
  markedAllRead: "Marked all notifications as read",
  markAllRead: "Mark all as read",
  unread: "Unread",
  subtitle: "Notifications from this workspace, by date.",
  allCaughtUp: "You're all caught up",
  noUnread: "No unread notifications.",
  emptyTitle: "No notifications",
  emptyDescription: "Mentions, assignments, and comments show up here.",
  inboxSubtitle: "Mentions, assignments, comments, and updates in one place.",
  inboxList: "Inbox",
  unreadOnly: "Unread only",
  inboxEmpty: "Nothing new to handle.",
  preview: "Preview",
  backToList: "Back to list",
  openTask: "Open task",
  openProject: "Open project",
  openStock: "Open inventory",
  reply: "Reply",
  markUnread: "Mark as unread",
  targetGone: "This item was deleted, or you don't have access.",
  pickHint: "Select a notification on the left to see it here.",
} satisfies Messages["notifications"];
