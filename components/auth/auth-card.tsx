// 인증·온보딩 화면 공용 카드. 제목 위 그림·제목·설명·본문·하단 링크 영역을 둔다
import "@/components/auth/lucian-auth.css";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
  art,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  // 제목 위 그림(#064 봉투 등)
  art?: React.ReactNode;
  className?: string;
}) {
  return (
    // u062: #062 카드(반지름·그림자·안쪽 간격). 폼 전체 오류가 오면 useAuthAction이 이 카드를 흔든다
    <section aria-labelledby="auth-title" className={cn("u062 w-full max-w-[400px]", className)}>
      {art}
      <h1 id="auth-title" tabIndex={-1} className="u062-h outline-none">
        {title}
      </h1>
      {description && <p className="u062-desc">{description}</p>}
      {children && <div className="mt-[22px]">{children}</div>}
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
// 높이·반지름은 SubmitButton(#062)과 같은 54px·17px로 맞춘다
export const buttonClass = "h-[54px] w-full rounded-[17px] text-[length:var(--fs-base)]";
export const primaryHover = "hover:bg-primary/90";
