// 홈 일본어 문구
import type { Messages } from "../types";

export default {
  greeting: {
    morning: "おはようございます、{name}さん",
    afternoon: "こんにちは、{name}さん",
    evening: "こんばんは、{name}さん",
  },
  subtitle: "{date} · ワークスペース全体の動きを確認しましょう。",
  summary: "概要",
  myTasks: {
    title: "マイタスク",
    tabs: "マイタスクのグループ",
    empty: {
      upcoming: "今後のタスクはありません",
      overdue: "期限切れのタスクはありません",
      done: "完了したタスクはありません",
    },
    noDue: "期限なし",
    viewAll: { one: "{count} 件のタスクを表示", other: "{count} 件のタスクをすべて表示" },
  },
  progress: {
    title: "プロジェクトの進捗",
    empty: "プロジェクトはまだありません",
    bar: "{name} の進捗",
    team: "チーム {names}",
  },
  deadlines: {
    title: "近づいている期限",
    empty: "近づいている期限はありません",
    collapse: "折りたたむ",
    more: { one: "他 {count} 件", other: "他 {count} 件" },
  },
  activity: {
    title: "最近のアクティビティ",
    empty: "アクティビティはまだありません",
  },
  complete: {
    reopen: "{key} を未完了に戻す",
    markDone: "{key} を完了にする",
  },
  load: {
    projects: "プロジェクトの進捗",
    activity: "最近のアクティビティ",
  },
  errors: {
    loadFailed: "{what}を読み込めませんでした。{reason}",
  },
} satisfies Messages["home"];
