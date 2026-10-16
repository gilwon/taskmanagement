// 댓글 일본어 문구
import type { Messages } from "../types";

export default {
  errors: {
    notFound: "コメントが見つかりません。削除されたか、アクセス権がない可能性があります。",
    forbidden: "このコメントに対する権限がありません。",
    conflict: "削除後にこのコメントが変更されたため、元に戻せません。",
    invalidInput: "コメントを入力してください。",
  },
  loadFailed: "コメントを読み込めませんでした。{error}",
  loading: "コメントを読み込み中…",
  empty: "コメントはまだありません",
  posted: "コメントを追加しました",
  saved: "コメントを更新しました",
  deleted: "コメントを削除しました",
  undo: "元に戻す",
  restored: "コメントを復元しました",
  edited: "· 編集済み",
  menu: "{name} のコメントメニュー",
  edit: "編集",
  delete: "削除",
  editLabel: "コメントを編集",
  inputLabel: "コメントを書く",
  viewOnly: "閲覧のみの権限のため、コメントできません。",
  placeholder: "コメントを入力… @ でメンション",
  send: "送信",
  mentionList: "メンションするメンバー",
  notified: "通知を受け取る人",
  sendHint: "⌘/Ctrl+Enter で送信",
  reactionChip: "{emoji} リアクション、{count} 件: {names}",
  reactionAdd: "リアクションを追加",
  reaction: "{emoji} リアクション",
} satisfies Messages["comments"];
