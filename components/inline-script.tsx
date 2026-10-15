"use client";
// 첫 페인트 전에 실행할 head 인라인 스크립트
// 서버 HTML에서만 실행되고 클라이언트 렌더에서는 text/plain이라 React의 script 태그 경고가 나지 않는다
// (Next.js 문서 Preventing Flash before hydration의 InlineScript 패턴)
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
