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
  // 結果なしカード(Lucian #092)。絞った検索範囲を外すと出る結果を知らせる
  scopeFilters: "適用中の検索範囲",
  removeScope: "{scope}の範囲を外す",
  widen: "外すと",
  widenCount: "{n}件",
  widenAria: "{scope}の範囲を外すと{n}件",
} satisfies Messages["search"];
