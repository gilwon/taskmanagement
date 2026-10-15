// 페이지 머리말. h1 제목·부제와 오른쪽 액션 슬롯, 좌우 여백은 --gutter
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-(--gutter) pt-(--s-6) pb-(--s-4)">
      <div className="min-w-0">
        <h1 className="text-(length:--fs-2xl) leading-tight font-semibold tracking-tight text-(--text)">{title}</h1>
        {subtitle && <p className="mt-1 text-(length:--fs-base) text-(--text-3)">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
