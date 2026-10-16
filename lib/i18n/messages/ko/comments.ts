// 댓글 한국어 문구
export default {
  // 댓글 RPC 오류 코드(P0001)별 안내. 나머지는 작업 오류 문구를 쓴다
  errors: {
    notFound: "댓글을 찾을 수 없습니다. 삭제되었거나 볼 권한이 없습니다.",
    forbidden: "이 댓글에 대한 권한이 없습니다.",
    conflict: "삭제한 뒤 바뀐 댓글이라 되돌릴 수 없습니다.",
    invalidInput: "댓글 내용을 입력해 주세요.",
  },
  loadFailed: "댓글을 불러오지 못했습니다. {error}",
  loading: "댓글을 불러오는 중…",
  empty: "아직 댓글이 없습니다",
  posted: "댓글을 남겼습니다",
  saved: "댓글을 수정했습니다",
  deleted: "댓글을 삭제했습니다",
  undo: "실행 취소",
  restored: "댓글을 되살렸습니다",
  edited: "· 수정됨",
  menu: "{name}님의 댓글 메뉴",
  edit: "수정",
  delete: "삭제",
  editLabel: "댓글 수정",
  inputLabel: "댓글 입력",
  viewOnly: "보기 권한만 있어 댓글을 남길 수 없습니다.",
  // 입력창
  placeholder: "댓글을 남기세요… @로 구성원을 멘션할 수 있습니다",
  send: "보내기",
  mentionList: "멘션할 구성원",
  sendHint: "⌘/Ctrl+Enter로 보내기",
  // 반응
  reactionChip: "{emoji} 반응 {count}개: {names}",
  reactionAdd: "반응 추가",
  reaction: "{emoji} 반응",
} as const;
