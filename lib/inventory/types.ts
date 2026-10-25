// 재고 화면 공용 타입. 품목·위치·재고량·이동 이력의 화면용 camelCase 형태를 정의한다

export type StockMovementKind = "in" | "out" | "transfer" | "adjust";

// 합계와 안전재고로 정한 품목 상태
export type StockStatus = "ok" | "low" | "out";

export type StockItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string | null;
  safetyStock: number;
  archived: boolean;
};

export type StockLocation = {
  id: string;
  name: string;
  archived: boolean;
};

// 한 품목의 한 위치 재고량
export type StockLevel = {
  itemId: string;
  locationId: string;
  qty: number;
};

// 이동 이력 한 건. balanceAfter는 해당 위치의 이동 후 수량, totalAfter는 품목 전체 합계
export type StockMovement = {
  id: string;
  kind: StockMovementKind;
  itemId: string;
  locationId: string;
  toLocationId: string | null;
  qty: number;
  balanceAfter: number;
  totalAfter: number;
  note: string | null;
  createdAt: string;
  actorName: string | null;
};

// 목록에 그리는 품목 한 줄. 위치별 재고와 합계·상태를 붙인다
export type StockItemRow = StockItem & {
  total: number;
  levels: StockLevel[];
  status: StockStatus;
};
