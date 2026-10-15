// 키보드 단축키 목록(META §6). 단축키 모달과 설정의 키보드 단축키 화면이 함께 쓴다.
// keys의 "Mod"는 macOS에서 ⌘, 그 밖에서 Ctrl로 보인다. 연달아 누르는 키는 then으로 둔다
export type ShortcutItem = { keys: string[]; then?: string[]; label: string };
export type ShortcutGroup = { title: string; items: ShortcutItem[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "일반",
    items: [
      { keys: ["Mod", "K"], label: "커맨드 팔레트 열기·닫기" },
      { keys: ["/"], label: "워크스페이스 검색" },
      { keys: ["?"], label: "키보드 단축키 보기" },
      { keys: ["Mod", "Shift", "L"], label: "다크 모드 전환" },
      { keys: ["["], label: "사이드바 접기·펼치기" },
      { keys: ["Esc"], label: "팝오버·대화상자·드로어 닫기, 선택 해제" },
    ],
  },
  {
    title: "만들기",
    items: [
      { keys: ["N"], label: "새 작업" },
      { keys: ["P"], label: "새 프로젝트" },
      { keys: ["Mod", "Enter"], label: "대화상자 제출, 댓글 보내기" },
    ],
  },
  {
    title: "이동",
    items: [
      { keys: ["G"], then: ["H"], label: "홈" },
      { keys: ["G"], then: ["T"], label: "내 작업" },
      { keys: ["G"], then: ["P"], label: "프로젝트" },
      { keys: ["G"], then: ["I"], label: "수신함" },
      { keys: ["G"], then: ["C"], label: "캘린더" },
      { keys: ["G"], then: ["S"], label: "설정" },
      { keys: ["G"], then: ["N"], label: "알림" },
      { keys: ["G"], then: ["A"], label: "활동" },
      { keys: ["G"], then: ["M"], label: "구성원" },
    ],
  },
  {
    title: "작업",
    items: [
      { keys: ["E"], label: "열린 작업 편집(드로어)" },
      { keys: ["1–5"], label: "상태 선택에서 상태 고르기" },
      { keys: ["Alt", "↑↓"], label: "목록·보드에서 순서 옮기기" },
      { keys: ["Alt", "←→"], label: "보드에서 열 옮기기" },
      { keys: ["Shift", "F10"], label: "작업 메뉴 열기(우클릭 메뉴)" },
      { keys: ["Space"], label: "목록·보드에서 작업 선택" },
    ],
  },
];

// 단축키 표시 글자. Mod는 플랫폼에 따라 바꾼다
export function keyLabel(key: string, mac: boolean) {
  if (key === "Mod") return mac ? "⌘" : "Ctrl";
  if (key === "Shift") return mac ? "⇧" : "Shift";
  if (key === "Alt") return mac ? "⌥" : "Alt";
  if (key === "Enter") return "↵";
  return key;
}
