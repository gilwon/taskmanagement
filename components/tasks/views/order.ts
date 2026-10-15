// 드래그·키보드 이동 때 새 sort_order를 정하는 순수 함수. 앞뒤 작업의 중간값, 맨 앞·맨 뒤는 ±1

// shortcut: 같은 자리에 반복해 끼우면 소수 정밀도가 바닥난다(약 50회). 그 전에 그룹 전체 재번호가 필요해지면 서버 RPC로 옮긴다
export function orderBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return next! - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}

// 순서대로 놓인 목록(끌고 있는 작업은 뺀 것)의 index 자리에 들어갈 값
export function orderAt(orders: readonly number[], index: number): number {
  const i = Math.max(0, Math.min(index, orders.length));
  return orderBetween(orders[i - 1] ?? null, orders[i] ?? null);
}
