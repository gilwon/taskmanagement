"use client";
// 인증 화면용 화면 전환 안내. 셸의 RouteAnnouncer와 같이 경로가 바뀌면 새 화면의 h1(없으면 문서 제목)을 #sr-live로 알린다
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const liveRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // 첫 진입은 알리지 않는다
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = requestAnimationFrame(() => {
      const h1 = document.querySelector("#main-content h1");
      if (liveRef.current) liveRef.current.textContent = h1?.textContent || document.title;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return <div id="sr-live" ref={liveRef} aria-live="polite" className="sr-only" />;
}
