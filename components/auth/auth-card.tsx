// 인증·온보딩 화면 공용 카드. 제목·설명·본문·하단 링크 영역을 둔다
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className={cn(
        "w-full max-w-[400px] bg-[var(--surface)] p-[var(--s-8)] max-[480px]:p-[var(--s-6)]",
        "rounded-[var(--r-lg)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <h1 id="auth-title" tabIndex={-1} className="outline-none text-[length:var(--fs-xl)] font-semibold text-[var(--text)]">
        {title}
      </h1>
      {description && (
        <p className="mt-[var(--s-2)] text-[length:var(--fs-base)] leading-relaxed text-[var(--text-2)]">
          {description}
        </p>
      )}
      {children && <div className="mt-[var(--s-6)]">{children}</div>}
      {footer && (
        <div className="mt-[var(--s-6)] text-center text-[length:var(--fs-sm)] text-[var(--text-3)]">{footer}</div>
      )}
    </section>
  );
}

// 카드 안 텍스트 링크. 밑줄로 링크임을 색 외에도 알린다
export const linkClass =
  "font-medium text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] rounded-[var(--r-xs)]";

// 카드 안 큰 버튼. 기본 hover(bg-primary/80)는 밝은 테마에서 흰 글자 대비가 AA 미만이라 /90으로 덮는다
export const buttonClass = "h-[var(--h-lg)] w-full rounded-[var(--r)] text-[length:var(--fs-base)]";
export const primaryHover = "hover:bg-primary/90";
