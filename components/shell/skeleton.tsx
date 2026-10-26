// 로딩 뼈대 공용 조각. 머리말·표 행·카드 변형을 서버 컴포넌트에서 그대로 쓴다
// Lucian UX/UI Prompt #079 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#079
import "./lucian-skeleton.css";

// 뼈대 영역 루트. 스크린리더에는 불러오는 중임만 알린다
export function SkeletonRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="ux u079" aria-busy="true">
      {children}
    </div>
  );
}

// 빛이 훑는 회색 블록 하나. 크기는 className으로 정한다
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span className={`u079-s block ${className}`} aria-hidden>
      <span className="u079-sk" />
    </span>
  );
}

// PageHeader와 같은 여백의 머리말 뼈대
export function SkeletonHeader({ actions = false }: { actions?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-(--gutter) pt-(--s-6) pb-(--s-4)">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-7 w-48 max-w-full rounded-(--r-sm)" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-(--r-sm)" />
      </div>
      {actions && <Skeleton className="h-(--h-md) w-24 shrink-0 rounded-(--r-sm)" />}
    </div>
  );
}

// 필터 막대 뼈대
export function SkeletonToolbar() {
  return (
    <div className="mx-(--gutter) mb-(--s-3) flex items-center gap-(--s-2)">
      <Skeleton className="h-(--h-md) w-full max-w-xs rounded-(--r-sm)" />
      <Skeleton className="h-(--h-md) w-20 rounded-(--r-sm)" />
    </div>
  );
}

// 표 뼈대. 줄마다 첫 칸은 넓게, 나머지는 좁은 화면에서 숨긴다
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="mx-(--gutter) overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-11 items-center gap-3 border-b border-(--divider) px-(--s-4) last:border-b-0">
          <Skeleton className="h-3.5 min-w-0 flex-1 rounded-(--r-xs)" />
          <Skeleton className="hide-m h-3.5 w-24 shrink-0 rounded-(--r-xs)" />
          <Skeleton className="h-3.5 w-16 shrink-0 rounded-(--r-xs)" />
          <Skeleton className="hide-m h-3.5 w-16 shrink-0 rounded-(--r-xs)" />
        </li>
      ))}
    </ul>
  );
}

// 카드 뼈대. 숫자 카드(stat)와 목록 카드에 같이 쓴다
export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-(--r-lg) bg-(--surface) px-(--s-4) py-(--s-3) shadow-(--shadow-card) ${className}`}>
      <Skeleton className="h-3.5 w-24 rounded-(--r-xs)" />
      <div className="mt-(--s-3) grid gap-(--s-2)">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3.5 rounded-(--r-xs) ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
