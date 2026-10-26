// 검색 한국어 문구
export default {
  loadFailed: "검색 결과를 불러오지 못했습니다. {error}",
  subtitle: "작업·프로젝트·사람·파일·댓글을 검색합니다.",
  emptyTitle: "검색어를 입력하세요",
  emptyDescription: "작업·프로젝트·사람·파일·댓글을 찾습니다.",
  // 검색 입력
  queryLabel: "검색어",
  placeholder: "작업·프로젝트·사람·파일·댓글 검색",
  submit: "검색",
  recent: "최근 검색",
  // 검색 결과
  scope: "검색 범위",
  noResultsTitle: "결과가 없습니다",
  noResultsDescription: "“{q}”와 일치하는 항목이 없습니다.",
  seeAll: "모두 보기",
  // 결과 없음 카드(Lucian #092). 좁힌 검색 범위를 풀면 나오는 결과를 알려 준다
  scopeFilters: "적용된 검색 범위",
  removeScope: "{scope} 범위 풀기",
  widen: "풀면",
  widenCount: "{n}개",
  widenAria: "{scope} 범위를 풀면 {n}개",
} as const;
