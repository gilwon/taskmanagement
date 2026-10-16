// 홈 한국어 문구
export default {
  // 서울 시각 5~11시 아침, 12~17시 오후, 그 밖은 저녁
  greeting: {
    morning: "좋은 아침이에요, {name}님",
    afternoon: "좋은 오후예요, {name}님",
    evening: "좋은 저녁이에요, {name}님",
  },
  // date는 "10월 16일 금요일"
  subtitle: "{date} · 워크스페이스 전체에서 일어나는 일을 확인하세요.",
  summary: "요약",
  myTasks: {
    title: "내 작업",
    tabs: "내 작업 구분",
    empty: {
      upcoming: "예정된 작업이 없습니다",
      overdue: "기한이 지난 작업이 없습니다",
      done: "완료한 작업이 없습니다",
    },
    noDue: "기한 없음",
    // 예정 탭의 작업을 방금 모두 완료했을 때 빈 문구 대신 한 번 보인다
    allDone: "다가오는 작업을 모두 끝냈어요",
    viewAll: { one: "작업 {count}개 모두 보기", other: "작업 {count}개 모두 보기" },
  },
  progress: {
    title: "프로젝트 진행",
    empty: "아직 프로젝트가 없습니다",
    bar: "{name} 진행률",
    team: "팀 {names}",
  },
  deadlines: {
    title: "다가오는 마감",
    empty: "예정된 마감이 없습니다",
    collapse: "접기",
    more: { one: "+{count}개 더", other: "+{count}개 더" },
  },
  activity: {
    title: "최근 활동",
    empty: "아직 활동이 없습니다",
  },
  // 완료 토글(components/home/parts.tsx). 내 작업 화면도 쓴다
  complete: {
    reopen: "{key} 다시 열기",
    markDone: "{key} 완료로 표시",
  },
  // 불러오기 실패 문구의 대상(errors.loadFailed의 {what})
  load: {
    projects: "프로젝트 진행",
    activity: "최근 활동",
  },
  errors: {
    loadFailed: "{what}을(를) 불러오지 못했습니다. {reason}",
  },
} as const;
