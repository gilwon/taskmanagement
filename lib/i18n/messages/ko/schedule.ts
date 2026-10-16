// 캘린더·타임라인·내 작업 한국어 문구
export default {
  // 주 보기 제목(lib/schedule/dates weekTitle). month·from·to는 Intl 월 이름("10월"), 연도는 숫자 문자열이다
  weekTitle: {
    sameMonth: "{year}년 {month}",
    crossMonth: "{year}년 {from} – {to}",
    crossYear: "{fromYear}년 {from} – {toYear}년 {to}",
  },
  // 캘린더 머리말 내비(components/schedule/calendar-nav.tsx)
  nav: {
    today: "오늘",
    prevWeek: "이전 주",
    prevMonth: "이전 달",
    nextWeek: "다음 주",
    nextMonth: "다음 달",
    legend: "프로젝트 범례",
    unit: "보기 단위",
    month: "월",
    week: "주",
  },
  // 월·주 캘린더 그리드(components/schedule/month-calendar.tsx)
  calendar: {
    hint: "화살표로 날짜를 옮기고 Enter로 그 날 항목을 엽니다. 항목 목록에서 Alt+좌우 화살표로 작업 기한을 하루씩 옮깁니다.",
    weekGrid: "{date} 주 캘린더",
    monthGrid: "{month} 캘린더",
    today: "오늘",
    taskCount: { one: "작업 {count}개", other: "작업 {count}개" },
    eventCount: { one: "일정 {count}개", other: "일정 {count}개" },
    addOn: "{date}에 새 작업",
    more: { one: "+{count}개 더", other: "+{count}개 더" },
    dayItems: "{date} 항목",
    newTask: "새 작업",
    noEvents: "예정된 일정이 없습니다",
    eventMoved: "일정 {title}을(를) {date}로 옮겼습니다",
    taskMoved: "{key} 작업 기한을 {date}로 옮겼습니다",
    taskMovedWithStart: "{key} 작업 기한을 {date}로 옮겼습니다. 시작일은 {start}",
  },
  // 타임라인(components/schedule/timeline.tsx)
  timeline: {
    noSchedule: "일정 없음",
    range: "{from}부터 {to}까지",
    moved: "{key} 작업 일정을 {range}로 옮겼습니다",
    group: "그룹: {group}",
    zoom: "확대",
    week: "주",
    month: "월",
    today: "오늘",
    emptyTitle: "타임라인에 표시할 작업이 없습니다",
    emptyDescription: "작업에 시작일과 기한을 넣으면 여기에 보입니다.",
    hint: "Enter로 작업을 엽니다. 좌우 화살표로 일정을 하루씩 옮기고, Shift+좌우 화살표로 기한 끝을 조절합니다.",
    taskColumn: "작업",
    milestones: "마일스톤",
    subtasks: "하위 작업 {total}개 중 {done}개 완료",
    milestone: "마일스톤 {name}, {date}, {project}",
  },
  // 필터 결과가 비었을 때(타임라인·내 작업)
  noResults: {
    title: "결과가 없습니다",
    description: "이 조건에 맞는 작업이 없습니다.",
    clearFilters: "필터 지우기",
  },
  // 내 작업 화면(components/my-tasks/my-tasks-view.tsx)
  myTasks: {
    subtitle: "오늘 마감 {today}개 · 기한 지남 {overdue}개 · 예정 {upcoming}개",
    priority: "우선순위 {label}, 바꾸기",
    // 우선순위 없음은 "우선순위" 없이 라벨만 읽는다
    priorityNone: "{label}, 바꾸기",
    due: "기한",
    dueValue: "기한 {due}, 바꾸기",
    dueNone: "기한 없음, 바꾸기",
    setDate: "날짜 지정",
    viewMode: "보기 방식",
    emptyTitle: "작업이 없습니다",
    emptyDescription: "작업을 추가해 일을 시작하세요.",
    addTask: "작업 추가",
  },
  // 캘린더·타임라인 화면 부제
  calendarSubtitle: "모든 프로젝트의 마감과 일정",
  timelineSubtitle: "프로젝트 전반의 일정, 의존성, 마일스톤",
  // 불러오기 실패 문구의 대상(errors.loadFailed의 {what})
  load: {
    events: "일정",
    milestones: "마일스톤",
  },
  errors: {
    loadFailed: "{what}을(를) 불러오지 못했습니다. {reason}",
    eventNotFound: "일정을 찾을 수 없습니다. 삭제되었거나 바꿀 권한이 없습니다.",
    permsLoadFailed: "프로젝트 권한을 불러오지 못했습니다.",
  },
} as const;
