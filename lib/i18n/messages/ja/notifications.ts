// 알림·수신함 일본어 문구
import type { Messages } from "../types";

export default {
  line: {
    mention: "{actor}さんがコメントであなたをメンションしました",
    assign: "{actor}さんがあなたを担当者に設定しました",
    comment: "{actor}さんがあなたのタスクにコメントしました",
    update: "{actor}さんが{text}",
  },
  loadFailed: "通知を読み込めませんでした。{error}",
  markedAllRead: "すべての通知を既読にしました",
  markAllRead: "すべて既読にする",
  unread: "未読",
  subtitle: "このワークスペースの通知を日付順に表示します。",
  allCaughtUp: "すべて確認済みです",
  noUnread: "未読の通知はありません。",
  emptyTitle: "通知はありません",
  emptyDescription: "メンション、担当割り当て、コメントがここに表示されます。",
  inboxSubtitle: "メンション、担当割り当て、コメント、更新をひとつの場所で確認できます。",
  inboxList: "受信トレイ",
  unreadOnly: "未読のみ",
  inboxEmpty: "新しく対応する項目はありません。",
  preview: "プレビュー",
  backToList: "一覧に戻る",
  openTask: "タスクを開く",
  openProject: "プロジェクトを開く",
  reply: "返信",
  markUnread: "未読にする",
  targetGone: "この項目は削除されたか、アクセス権がありません。",
  pickHint: "左側の通知を選択すると、ここに表示されます。",
} satisfies Messages["notifications"];
