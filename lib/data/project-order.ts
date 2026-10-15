// 사이드바 프로젝트 순서(user_prefs.proj_order) 계산. 서버 정렬과 사이드바 끌어 놓기가 함께 쓴다

// 저장된 순서에 있는 프로젝트를 그 순서로 앞에, 없는 프로젝트(새로 만들었거나 처음 보는 것)는 원래 순서(이름순)로 뒤에 둔다
export function orderProjects<T extends { id: string }>(projects: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return projects
    .map((p, i) => ({ p, r: rank.get(p.id) ?? order.length + i }))
    .sort((a, b) => a.r - b.r)
    .map(({ p }) => p);
}

// id를 빼고 남은 목록의 index 자리에 다시 넣는다. 없는 id면 그대로 돌려준다
export function moveId(ids: string[], id: string, index: number): string[] {
  if (!ids.includes(id)) return ids;
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
