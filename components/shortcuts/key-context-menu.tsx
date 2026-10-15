"use client";
// 우클릭 메뉴 공용 틀. 자식 요소를 트리거로 감싸고, Shift+F10·메뉴 키로도 열며, 키보드로 연 경우 닫을 때 연 요소로 포커스를 돌려준다.
// 끌기가 있는 대상(blockTouch)은 터치 길게 누르기를 드래그에 양보하고 메뉴를 열지 않는다. 같은 항목은 ⋯ 메뉴가 준다
import { useRef } from "react";
import { toast } from "sonner";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";

// ⋯ 메뉴(DropdownMenuItem)와 우클릭 메뉴(ContextMenuItem)가 같은 항목 목록을 그리도록 받는 항목 컴포넌트
export type MenuItemComponent = React.ComponentType<{
  onSelect?: (e: Event) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  children?: React.ReactNode;
}>;

// 메뉴의 복사 항목. 결과를 토스트로 알린다. what은 목적격 조사 "를"이 붙는 말(키·링크)
export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what}를 복사했습니다`);
  } catch {
    toast.error(`${what}를 복사하지 못했습니다.`);
  }
}

// 키보드로 연 메뉴는 포인터 좌표가 없으므로 요소 왼쪽 아래에 띄운다
function openFromKeyboard(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 16, clientY: r.bottom - 4 }),
  );
}

export function KeyContextMenu({
  label,
  menu,
  children,
  blockTouch = false,
  className,
  onOpenChange,
}: {
  // 메뉴의 접근 가능한 이름
  label: string;
  menu: React.ReactNode;
  children: React.ReactElement;
  blockTouch?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const lastPointer = useRef<string>("mouse");
  // 키보드로 연 경우 닫을 때 포커스를 돌려줄 요소
  const keyboardOpener = useRef<HTMLElement | null>(null);

  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger
        asChild
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
          if (blockTouch && e.pointerType === "touch") e.preventDefault();
        }}
        onContextMenu={(e) => {
          if (blockTouch && lastPointer.current === "touch") e.preventDefault();
        }}
        onKeyDown={(e) => {
          const el = e.currentTarget as HTMLElement;
          // 팝오버는 포털이라 React 트리로는 이 요소 안이어도 DOM으로는 밖이다. 그 안의 키는 받지 않는다
          if (!el.contains(e.target as Node)) return;
          if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") {
            e.preventDefault();
            lastPointer.current = "keyboard";
            keyboardOpener.current = e.target as HTMLElement;
            openFromKeyboard(el);
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className={className ?? "w-52"}
        aria-label={label}
        onCloseAutoFocus={(e) => {
          const el = keyboardOpener.current;
          keyboardOpener.current = null;
          if (!el?.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
      >
        {menu}
      </ContextMenuContent>
    </ContextMenu>
  );
}
