// 일정 화면 공용 타입. 캘린더 일정(events)과 타임라인 마일스톤의 화면용 형태
export type CalendarEvent = {
  id: string;
  title: string;
  // "YYYY-MM-DD"
  date: string;
  // "HH:MM" 또는 null(종일)
  time: string | null;
  project: { id: string; name: string; color: string };
};

export type CalendarMode = "month" | "week";

export type Milestone = {
  id: string;
  name: string;
  // "YYYY-MM-DD"
  date: string;
  project: { id: string; name: string; color: string };
};
