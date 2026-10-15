// 빈 상태 안내. 아이콘·제목·설명·액션을 가운데 정렬로 보인다
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-(--gutter) flex flex-col items-center justify-center rounded-(--r-lg) border border-dashed border-(--border-strong) px-(--s-6) py-(--s-12) text-center">
      <span className="mb-(--s-3) inline-flex size-10 items-center justify-center rounded-full bg-(--surface-2) text-(--text-3)">
        <Icon aria-hidden size={18} strokeWidth={1.8} />
      </span>
      <p className="text-(length:--fs-md) font-medium text-(--text)">{title}</p>
      {description && <p className="mt-1 max-w-md text-(length:--fs-base) text-(--text-3)">{description}</p>}
      {action && <div className="mt-(--s-4)">{action}</div>}
    </div>
  );
}
