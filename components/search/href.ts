// 검색 화면 URL(?q=&tab=). 서버 결과 화면과 클라이언트 입력이 함께 쓴다
import type { SearchScope } from "@/lib/search/types";

export function searchHref(wsSlug: string, q: string, tab: SearchScope) {
  const params = new URLSearchParams({ q });
  if (tab !== "all") params.set("tab", tab);
  return `/${wsSlug}/search?${params.toString()}`;
}
