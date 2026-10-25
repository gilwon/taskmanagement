// 알림·수신함 한국어 문구
export default {
  // 알림 한 줄 문장 틀. {actor}는 굵게 보이는 보낸 사람 이름이다.
  // DB가 종류마다 고정 문구를 넣으므로 종류별 틀로 보이고, 고정 문구가 없는 update만 DB 문구({text})를 쓴다
  line: {
    mention: "{actor}님이 댓글에서 회원님을 멘션했습니다",
    assign: "{actor}님이 회원님을 담당자로 지정했습니다",
    comment: "{actor}님이 회원님의 작업에 댓글을 남겼습니다",
    update: "{actor}님이 {text}",
    stock: "'{text}'의 재고가 안전재고 아래로 내려갔습니다",
  },
  loadFailed: "알림을 불러오지 못했습니다. {error}",
  markedAllRead: "알림을 모두 읽음으로 표시했습니다",
  markAllRead: "모두 읽음으로 표시",
  unread: "읽지 않음",
  // 알림 화면
  subtitle: "워크스페이스에서 받은 알림을 날짜별로 봅니다.",
  allCaughtUp: "모두 확인했습니다",
  noUnread: "읽지 않은 알림이 없습니다.",
  emptyTitle: "알림이 없습니다",
  emptyDescription: "멘션·담당자 지정·댓글 알림이 여기에 모입니다.",
  // 수신함
  inboxSubtitle: "멘션·담당자 지정·댓글·업데이트를 한곳에서 확인합니다.",
  inboxList: "수신함 목록",
  unreadOnly: "읽지 않음만",
  inboxEmpty: "새로 처리할 알림이 없습니다.",
  preview: "미리보기",
  backToList: "목록으로",
  openTask: "작업 열기",
  openProject: "프로젝트 열기",
  openStock: "재고 열기",
  reply: "답글",
  markUnread: "읽지 않음으로 표시",
  targetGone: "대상이 삭제되었거나 볼 권한이 없습니다.",
  pickHint: "왼쪽에서 알림을 고르면 여기에 보입니다.",
} as const;
