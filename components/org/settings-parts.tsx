"use client";
// 설정 화면 공용 틀. 섹션 제목, 카드, 이름-값 행, 미제공 배지. 서버·클라이언트 컴포넌트 양쪽에서 쓴다.
// 미제공 배지가 사전(useT)을 읽어 클라이언트 컴포넌트로 둔다
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function SettingsTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-(--s-5)">
      <h1 className="text-(length:--fs-2xl) leading-tight font-semibold tracking-tight text-(--text)">{title}</h1>
      {subtitle && <p className="mt-1 text-(length:--fs-base) text-(--text-3)">{subtitle}</p>}
    </header>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  tone,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "danger";
  id?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "mb-(--s-4) rounded-(--r-lg) bg-(--surface) p-(--s-5) shadow-(--shadow-card)",
        tone === "danger" && "ring-1 ring-(--red)/40",
      )}
    >
      <h2 id={titleId} className={cn("text-(length:--fs-md) font-semibold text-(--text)", tone === "danger" && "text-(--red)")}>
        {title}
      </h2>
      {description && <p className="mt-1 text-(length:--fs-sm) text-(--text-3)">{description}</p>}
      {children && <div className="mt-(--s-4) grid gap-(--s-4)">{children}</div>}
    </section>
  );
}

// 읽기 전용 이름-값 행. 바꿀 수 없는 값은 이 행으로 보인다
export function InfoRow({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-(length:--fs-base) text-(--text-2)">{label}</span>
      <span className="text-right text-(length:--fs-base) text-(--text)">
        {value}
        {note && <span className="block text-(length:--fs-xs) text-(--text-3)">{note}</span>}
      </span>
    </div>
  );
}

export function UnavailableBadge() {
  const t = useT();
  return (
    <span className="inline-flex h-5 items-center rounded-(--r-xs) bg-(--surface-3) px-1.5 text-(length:--fs-2xs) font-medium text-(--text-3)">
      {t("common.unavailable")}
    </span>
  );
}

// 미제공 항목 한 줄. 조작할 수 있는 컨트롤을 두지 않는다(spec R23)
export function UnavailableRow({ label, description }: { label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-(length:--fs-base) text-(--text-2)">{label}</p>
        {description && <p className="text-(length:--fs-xs) text-(--text-3)">{description}</p>}
      </div>
      <UnavailableBadge />
    </div>
  );
}
