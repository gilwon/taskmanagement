"use client";
// 앱 셸 골격. 본문 건너뛰기, 사이드바(데스크톱 고정·좁은 화면 오프캔버스), 탑바, 메인, 하단 내비, 화면 전환 안내
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CommandProvider } from "@/components/command/command-provider";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import type { ShellData } from "@/lib/data/workspace";

// 경로가 바뀌면 새 화면의 h1(없으면 문서 제목)을 #sr-live로 알린다. 첫 진입은 알리지 않는다
function RouteAnnouncer() {
  const pathname = usePathname();
  const liveRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

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

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // 트리거 없이 여는 시트라 닫을 때 포커스를 돌려줄 버튼을 기억한다
  const opener = useRef<HTMLElement | null>(null);
  const openMenu = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setMenuOpen(true);
  };
  const closeMenu = () => setMenuOpen(false);

  return (
    <CommandProvider data={data}>
      <div className="app-shell">
        <button
          type="button"
          className="skip-link rounded-(--r-sm) bg-(--surface) px-3 py-2 text-(length:--fs-base) font-medium text-(--text) shadow-(--shadow-pop) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          onClick={() => document.getElementById("main-content")?.focus()}
        >
          본문으로 건너뛰기
        </button>

        <aside className="app-side border-r border-(--border)" aria-label="사이드바">
          <Sidebar data={data} />
        </aside>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              opener.current?.focus();
            }} className="app-sheet gap-0 border-(--border) bg-(--bg-side) p-0">
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <SheetDescription className="sr-only">워크스페이스 메뉴입니다. Esc로 닫습니다.</SheetDescription>
            <Sidebar data={data} inSheet onNavigate={closeMenu} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-col">
          <Topbar data={data} onOpenMenu={openMenu} />
          <main id="main-content" tabIndex={-1} className="app-main min-h-0 flex-1 overflow-y-auto outline-none">
            {children}
          </main>
        </div>

        <MobileNav data={data} onOpenMore={openMenu} />
        <RouteAnnouncer />
      </div>
    </CommandProvider>
  );
}
