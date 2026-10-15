// 견본 화면(디자인 시스템·화면 상태)의 섹션 틀과 견본 이름표. h2 제목·설명·본문을 같은 간격으로 놓는다
export function ShowcaseSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0 border-t border-(--divider) px-(--gutter) py-(--s-6)">
      <h2 id={id} className="text-(length:--fs-lg) font-semibold text-(--text)">
        {title}
      </h2>
      {description && <p className="mt-1 text-(length:--fs-sm) text-(--text-3)">{description}</p>}
      <div className="mt-(--s-4) flex min-w-0 flex-col gap-(--s-5)">{children}</div>
    </section>
  );
}

// 섹션 안의 소제목 묶음
export function ShowcaseGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-(--s-2) text-(length:--fs-sm) font-medium text-(--text-2)">{title}</h3>
      {children}
    </div>
  );
}

// 견본 하나와 그 아래 mono 이름표(변수·변형 이름)
export function Sample({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {children}
      <code className="font-mono text-(length:--fs-2xs) break-all text-(--text-3)">{name}</code>
    </div>
  );
}
