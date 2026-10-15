// 날짜·상대 시간 표시 포맷터. ko-KR, Asia/Seoul 기준이고 now를 인자로 받아 테스트할 수 있다.
// 구현은 lib/i18n/format.ts의 ko 포매터이고, 기존 호출부를 위해 이름을 그대로 내보낸다
import { createFormatter, seoulDay } from "@/lib/i18n/format";

const ko = createFormatter("ko");

export { seoulDay };

// 기한 표시. 오늘·내일·어제, 2~6일 차이는 요일, 7일 이상은 "10월 26일"(다른 해면 연도 포함)
export const formatDue = ko.due;

// 상대 시간 표시. 방금 → N분 전 → N시간 전 → N일 전(7일 미만), 그 이후는 formatDue 형식
export const formatRelative = ko.relative;

// 월 탐색 제목. "2026년 10월"
export const formatMonthTitle = ko.monthTitle;
