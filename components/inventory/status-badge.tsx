// 재고 상태 뱃지. 정상·부족·품절을 아이콘과 텍스트 라벨로 함께 보인다(색만으로 구분하지 않는다)
import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/lib/inventory/types";
import { useT } from "@/lib/i18n/client";

const TONE = {
  ok: { icon: CircleCheck, className: "bg-(--green-soft) text-(--green)" },
  low: { icon: AlertTriangle, className: "bg-(--amber-soft) text-(--amber)" },
  out: { icon: CircleX, className: "bg-(--red-soft) text-(--red)" },
} as const;

export function StatusBadge({ status }: { status: StockStatus }) {
  const t = useT();
  const { icon: Icon, className } = TONE[status];
  return (
    <Badge className={className}>
      <Icon aria-hidden strokeWidth={2} />
      {t(`inventory.status.${status}`)}
    </Badge>
  );
}
