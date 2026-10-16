// 홈 영어 문구
import type { Messages } from "../types";

export default {
  greeting: {
    morning: "Good morning, {name}",
    afternoon: "Good afternoon, {name}",
    evening: "Good evening, {name}",
  },
  subtitle: "{date} · See what's happening across your workspace.",
  summary: "Summary",
  myTasks: {
    title: "My tasks",
    tabs: "My task groups",
    empty: {
      upcoming: "No upcoming tasks",
      overdue: "No overdue tasks",
      done: "No completed tasks",
    },
    noDue: "No due date",
    allDone: "All upcoming tasks done",
    viewAll: { one: "View {count} task", other: "View all {count} tasks" },
  },
  progress: {
    title: "Project progress",
    empty: "No projects yet",
    bar: "{name} progress",
    team: "Team {names}",
  },
  deadlines: {
    title: "Upcoming deadlines",
    empty: "No upcoming deadlines",
    collapse: "Show less",
    more: { one: "+{count} more", other: "+{count} more" },
  },
  activity: {
    title: "Recent activity",
    empty: "No activity yet",
  },
  complete: {
    reopen: "Reopen {key}",
    markDone: "Mark {key} complete",
  },
  load: {
    projects: "project progress",
    activity: "recent activity",
  },
  errors: {
    loadFailed: "Couldn't load {what}. {reason}",
  },
} satisfies Messages["home"];
