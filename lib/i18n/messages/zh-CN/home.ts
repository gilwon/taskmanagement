// 홈 중국어 간체 문구
import type { Messages } from "../types";

export default {
  greeting: {
    morning: "早上好，{name}",
    afternoon: "下午好，{name}",
    evening: "晚上好，{name}",
  },
  subtitle: "{date} · 查看工作区的最新动态。",
  summary: "概览",
  myTasks: {
    title: "我的任务",
    tabs: "我的任务分组",
    empty: {
      upcoming: "暂无即将到期的任务",
      overdue: "暂无逾期任务",
      done: "暂无已完成的任务",
    },
    noDue: "无截止日期",
    allDone: "即将到期的任务已全部完成",
    viewAll: { one: "查看 {count} 个任务", other: "查看全部 {count} 个任务" },
  },
  progress: {
    title: "项目进度",
    empty: "暂无项目",
    bar: "{name} 进度",
    team: "团队 {names}",
  },
  deadlines: {
    title: "即将截止",
    empty: "暂无即将截止的任务",
    collapse: "收起",
    more: { one: "还有 {count} 项", other: "还有 {count} 项" },
  },
  activity: {
    title: "最近动态",
    empty: "暂无动态",
  },
  complete: {
    reopen: "重新打开 {key}",
    markDone: "将 {key} 标记为完成",
  },
  load: {
    projects: "项目进度",
    activity: "最近动态",
  },
  errors: {
    loadFailed: "无法加载{what}。{reason}",
  },
} satisfies Messages["home"];
