// 검색 일본어 문구
import type { Messages } from "../types";

export default {
  loadFailed: "検索結果を読み込めませんでした。{error}",
  subtitle: "タスク、プロジェクト、メンバー、ファイル、コメントを検索します。",
  emptyTitle: "検索キーワードを入力してください",
  emptyDescription: "タスク、プロジェクト、メンバー、ファイル、コメントを検索できます。",
  queryLabel: "検索キーワード",
  placeholder: "タスク、プロジェクト、メンバー、ファイル、コメントを検索",
  submit: "検索",
  recent: "最近の検索",
  scope: "検索範囲",
  noResultsTitle: "結果がありません",
  noResultsDescription: "「{q}」に一致する結果はありません。",
  seeAll: "すべて表示",
} satisfies Messages["search"];
