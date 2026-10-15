"use client";
// 보드 카드·목록 행 공용 드래그. Pointer Events 하나로 마우스·펜·터치를 처리하고, 놓을 자리는 화면 좌표 아래의 data 속성으로 찾는다.
// 묶음 요소에 data-drop-group={키}, 끌 수 있는 요소에 data-drag-id={작업 id}를 붙인다.
// 터치는 data-drag-handle(touch-action: none)에서 바로, 그 밖에서는 길게 눌러야 시작해 스크롤을 살린다
import { useCallback, useEffect, useRef, useState } from "react";

export type DropTarget = { group: string; index: number };

// 이 거리보다 적게 움직이면 클릭으로 본다
const THRESHOLD = 5;
// 스크롤 영역 가장자리에서 이 거리 안이면 자동으로 스크롤한다
const EDGE = 48;
const SCROLL_STEP = 14;
const LONG_PRESS = 350;

// 좌표 아래 묶음과, 그 묶음 안에서 끌고 있는 작업을 뺀 목록의 끼워 넣을 위치
function hitTest(x: number, y: number, dragId: string): DropTarget | null {
  const group = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-group]");
  if (!group) return null;
  const items = [...group.querySelectorAll<HTMLElement>("[data-drag-id]")].filter((n) => n.dataset.dragId !== dragId);
  const index = items.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
  return { group: group.dataset.dropGroup!, index };
}

function edgeScroll(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
  if (el.scrollWidth > el.clientWidth) {
    if (x < r.left + EDGE) el.scrollLeft -= SCROLL_STEP;
    else if (x > r.right - EDGE) el.scrollLeft += SCROLL_STEP;
  }
  if (el.scrollHeight > el.clientHeight) {
    if (y < r.top + EDGE) el.scrollTop -= SCROLL_STEP;
    else if (y > r.bottom - EDGE) el.scrollTop += SCROLL_STEP;
  }
}

export function useTaskDrag(onDrop: (id: string, target: DropTarget) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });
  // 드래그 중에 언마운트되면 고스트와 리스너를 치운다
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || cleanupRef.current) return;
    const el = e.currentTarget;
    const origin = e.target as HTMLElement;
    const onHandle = !!origin.closest("[data-drag-handle]");
    // 버튼·입력 위에서는 드래그하지 않는다
    if (!onHandle && origin.closest("button, a, input, textarea, select, [role=checkbox], [data-no-drag]")) return;
    const longPress = e.pointerType === "touch" && !onHandle;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const scrollers = [el.closest<HTMLElement>("[data-drag-scroll]"), document.getElementById("main-content")].filter(
      (s): s is HTMLElement => !!s,
    );
    let x = startX;
    let y = startY;
    let ghost: HTMLElement | null = null;
    let current: DropTarget | null = null;
    let raf = 0;
    // 길게 누르기 전에 손가락이 움직이면 스크롤로 보고 드래그를 포기한다
    let armed = !longPress;
    const pressTimer = longPress
      ? setTimeout(() => {
          armed = true;
          start();
          place();
        }, LONG_PRESS)
      : undefined;

    const retarget = () => {
      const next = hitTest(x, y, id);
      if (next?.group !== current?.group || next?.index !== current?.index) {
        current = next;
        setTarget(next);
      }
    };
    const tick = () => {
      for (const s of scrollers) edgeScroll(s, x, y);
      retarget();
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      // 원래 요소는 자리에 두고 복제본을 끌어 스크롤 영역 밖에서도 잘리지 않게 한다
      ghost = el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-drag-id");
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${rect.width}px`,
        margin: "0",
        zIndex: "60",
        pointerEvents: "none",
        boxShadow: "var(--shadow-drag)",
        background: "var(--surface)",
        borderRadius: "var(--r)",
        opacity: "0.96",
      });
      document.body.append(ghost);
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // 이미 끝난 포인터면 캡처 없이 진행한다
      }
      setDragId(id);
      raf = requestAnimationFrame(tick);
    };
    const place = () => {
      if (ghost) ghost.style.transform = `translate(${rect.left + x - startX}px, ${rect.top + y - startY}px) rotate(1deg)`;
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      x = ev.clientX;
      y = ev.clientY;
      if (!ghost) {
        const moved = Math.hypot(x - startX, y - startY) >= THRESHOLD;
        if (!armed) {
          if (moved) cleanup();
          return;
        }
        if (!moved) return;
        start();
      }
      ev.preventDefault();
      place();
      retarget();
    };
    const finish = (drop: boolean) => {
      const dragged = !!ghost;
      const dropAt = current;
      cleanup();
      if (!dragged) return;
      // 끌기 직후 따라오는 click이 카드를 열지 않게 한 번 막는다
      const stop = (ce: MouseEvent) => {
        ce.stopPropagation();
        ce.preventDefault();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
      if (drop && dropAt) onDropRef.current(id, dropAt);
    };
    const onUp = (ev: PointerEvent) => ev.pointerId === pointerId && finish(true);
    const onCancel = (ev: PointerEvent) => ev.pointerId === pointerId && finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && ghost) {
        ev.preventDefault();
        ev.stopPropagation();
        finish(false);
      }
    };

    // 드래그 중에는 터치 스크롤과 길게 누르기 메뉴를 막는다
    const onTouchMove = (te: TouchEvent) => ghost && te.preventDefault();
    const onContextMenu = (ce: Event) => longPress && ce.preventDefault();

    function cleanup() {
      clearTimeout(pressTimer);
      cancelAnimationFrame(raf);
      ghost?.remove();
      ghost = null;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("contextmenu", onContextMenu);
      cleanupRef.current = null;
      setDragId(null);
      setTarget(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("contextmenu", onContextMenu);
    cleanupRef.current = cleanup;
  }, []);

  return { dragId, target, onPointerDown };
}
