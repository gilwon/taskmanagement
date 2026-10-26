// 검색 중국어 간체 문구
import type { Messages } from "../types";

export default {
  loadFailed: "无法加载搜索结果。{error}",
  subtitle: "搜索任务、项目、成员、文件和评论。",
  emptyTitle: "请输入搜索词",
  emptyDescription: "查找任务、项目、成员、文件和评论。",
  queryLabel: "搜索词",
  placeholder: "搜索任务、项目、成员、文件、评论",
  submit: "搜索",
  recent: "最近搜索",
  scope: "搜索范围",
  noResultsTitle: "无结果",
  noResultsDescription: "没有与“{q}”匹配的内容。",
  seeAll: "查看全部",
  // 无结果卡片(Lucian #092)。告知取消已缩小的搜索范围后会出现的结果
  scopeFilters: "已应用的搜索范围",
  removeScope: "取消{scope}范围",
  widen: "取消后有",
  widenCount: "{n} 条",
  widenAria: "取消{scope}范围后有 {n} 条",
} satisfies Messages["search"];
