// 검색 영어 문구
import type { Messages } from "../types";

export default {
  loadFailed: "Couldn't load search results. {error}",
  subtitle: "Search tasks, projects, people, files, and comments.",
  emptyTitle: "Enter a search term",
  emptyDescription: "Find tasks, projects, people, files, and comments.",
  queryLabel: "Search term",
  placeholder: "Search tasks, projects, people, files, comments",
  submit: "Search",
  recent: "Recent searches",
  scope: "Search scope",
  noResultsTitle: "No results",
  noResultsDescription: "Nothing matches “{q}”.",
  seeAll: "See all",
  // No-results card (Lucian #092). Tells what you get by removing the narrowed scope
  scopeFilters: "Applied search scope",
  removeScope: "Remove {scope} scope",
  widen: "Remove to see",
  widenCount: "{n} results",
  widenAria: "Remove {scope} scope to see {n} results",
} satisfies Messages["search"];
