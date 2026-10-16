// 댓글 영어 문구
import type { Messages } from "../types";

export default {
  errors: {
    notFound: "Comment not found. It may have been deleted, or you don't have access.",
    forbidden: "You don't have permission for this comment.",
    conflict: "This comment changed after it was deleted, so it can't be restored.",
    invalidInput: "Enter a comment.",
  },
  loadFailed: "Couldn't load comments. {error}",
  loading: "Loading comments…",
  empty: "No comments yet",
  posted: "Comment added",
  saved: "Comment updated",
  deleted: "Comment deleted",
  undo: "Undo",
  restored: "Comment restored",
  edited: "· Edited",
  menu: "Comment menu for {name}",
  edit: "Edit",
  delete: "Delete",
  editLabel: "Edit comment",
  inputLabel: "Write a comment",
  viewOnly: "You have view-only access and can't comment.",
  placeholder: "Leave a comment… Use @ to mention someone",
  send: "Send",
  mentionList: "Members to mention",
  sendHint: "⌘/Ctrl+Enter to send",
  reactionChip: "{emoji} reaction, {count}: {names}",
  reactionAdd: "Add reaction",
  reaction: "{emoji} reaction",
} satisfies Messages["comments"];
