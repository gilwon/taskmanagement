// 키보드 단축키 한국어 문구
export default {
  title: "키보드 단축키",
  dialogHint: "입력창에 글자를 입력하는 중에는 한 글자 단축키가 동작하지 않습니다.",
  settingsHint: "입력 칸에 커서가 있을 때는 한 글자 단축키가 동작하지 않습니다.",
  // 연달아 누르는 키 사이 글자와 그 읽기 문구
  then: "다음",
  thenLabel: "{first} 다음 {second}",
  group: {
    general: "일반",
    create: "만들기",
    navigate: "이동",
    task: "작업",
  },
  item: {
    palette: "커맨드 팔레트 열기·닫기",
    search: "워크스페이스 검색",
    help: "키보드 단축키 보기",
    theme: "다크 모드 전환",
    sidebar: "사이드바 접기·펼치기",
    escape: "팝오버·대화상자·드로어 닫기, 선택 해제",
    submit: "대화상자 제출, 댓글 보내기",
    edit: "열린 작업 편집(드로어)",
    pickStatus: "상태 선택에서 상태 고르기",
    reorder: "목록·보드에서 순서 옮기기",
    moveColumn: "보드에서 열 옮기기",
    taskMenu: "작업 메뉴 열기(우클릭 메뉴)",
    select: "목록·보드에서 작업 선택",
  },
  // 메뉴의 복사 항목 결과. what은 목적격 조사 "를"이 붙는 말(키·링크)
  copied: "{what}를 복사했습니다",
  copyFailed: "{what}를 복사하지 못했습니다.",
} as const;
