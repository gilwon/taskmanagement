"use client";
// 보드 카드·목록 행 공용 드래그. Pointer Events 하나로 마우스·펜·터치를 처리하고, 놓을 자리는 화면 좌표 아래의 data 속성으로 찾는다.
// 묶음 요소에 data-drop-group={키}, 끌 수 있는 요소에 data-drag-id={작업 id}를 붙인다.
// 터치는 data-drag-handle(touch-action: none)에서 바로, 그 밖에서는 길게 눌러야 시작해 스크롤을 살린다
import { useCallback, useEffect, useRef, useState } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/prefs/prefs";

export type DropTarget = { group: string; index: number };
// 모션을 입힐 때 넘기는 선택 옵션. ghostClass를 고스트에 붙이고 떠오를 때 is-lift, 내려앉을 때 is-land를 더한다.
// 놓을 때 landOn()이 요소를 주면 고스트를 그 자리로 옮긴 뒤 onDrop을 부른다
export type DragMotion = { ghostClass?: string; landOn?: () => HTMLElement | null };

// 이 거리보다 적게 움직이면 클릭으로 본다
const THRESHOLD = 5;
// 스크롤 영역 가장자리에서 이 거리 안이면 자동으로 스크롤한다
const EDGE = 48;
const SCROLL_STEP = 14;
const LONG_PRESS = 350;
// 내려앉는 시간. board-motion.css의 .is-land 전환 시간과 맞춘다
const LAND_MS = 280;

// 앱 동작 설정(data-motion)이나 OS 설정이 움직임을 줄이면 내려앉기를 기다리지 않는다
const reducedMotion = () =>
  document.documentElement.dataset.motion !== "full" || matchMedia(REDUCED_MOTION_QUERY).matches;

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

export function useTaskDrag(onDrop: (id: string, target: DropTarget) => void, motion?: DragMotion) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  // 끄는 요소 높이. 원래 자리가 비는 보드가 같은 높이의 틈을 그린다
  const [height, setHeight] = useState(0);
  const onDropRef = useRef(onDrop);
  const motionRef = useRef(motion);
  useEffect(() => {
    onDropRef.current = onDrop;
    motionRef.current = motion;
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
    const ghostClass = motionRef.current?.ghostClass;

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
    let landTimer: ReturnType<typeof setTimeout> | undefined;
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
      });
      // 모션 클래스가 있으면 겉모습은 CSS가 맡는다. 인라인은 클래스 규칙을 덮기 때문이다
      if (!ghostClass)
        Object.assign(ghost.style, {
          boxShadow: "var(--shadow-drag)",
          background: "var(--surface)",
          borderRadius: "var(--r)",
          opacity: "0.96",
        });
      document.body.append(ghost);
      if (ghostClass) {
        ghost.classList.add(ghostClass);
        // 기본 상태를 한 번 계산시킨 뒤 is-lift를 붙여야 떠오르는 전환이 보인다
        void ghost.offsetWidth;
        ghost.classList.add("is-lift");
      }
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // 이미 끝난 포인터면 캡처 없이 진행한다
      }
      setDragId(id);
      setHeight(rect.height);
      raf = requestAnimationFrame(tick);
    };
    const place = () => {
      // 모션 클래스가 있으면 기울기는 CSS의 rotate가 맡는다
      if (ghost)
        ghost.style.transform = `translate(${rect.left + x - startX}px, ${rect.top + y - startY}px)${ghostClass ? "" : " rotate(1deg)"}`;
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
    // held는 Esc로 취소해 버튼이 아직 눌려 있는 경우다
    const finish = (drop: boolean, held = false) => {
      const dragged = !!ghost;
      const dropAt = current;
      const landAt = drop && ghost && ghostClass && !reducedMotion() ? motionRef.current?.landOn?.() : null;
      if (ghost && landAt) {
        // 내려앉는 동안 틈과 숨긴 카드는 그대로 두고 포인터 추적만 멈춘다. cleanupRef가 남아 있어 새 드래그는 시작되지 않는다
        detach();
        const r = landAt.getBoundingClientRect();
        ghost.classList.replace("is-lift", "is-land");
        ghost.style.transform = `translate(${r.left}px, ${r.top}px)`;
        landTimer = setTimeout(() => {
          // 같은 틱이라 React가 이동과 정리를 한 번에 그린다
          if (dropAt) onDropRef.current(id, dropAt);
          cleanup();
        }, LAND_MS);
      } else cleanup();
      if (!dragged) return;
      // 끌기 직후 따라오는 click이 카드를 열지 않게 한 번 막는다
      const stop = (ce: MouseEvent) => {
        ce.stopPropagation();
        ce.preventDefault();
      };
      const swallow = () => {
        window.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
      };
      if (held) {
        // 버튼을 뗄 때 오는 click은 포인터 캡처 때문에 카드로 가므로, 뗄 때까지 막기를 미룬다
        const release = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return;
          window.removeEventListener("pointerup", release, true);
          window.removeEventListener("pointercancel", release, true);
          if (ev.type === "pointerup") swallow();
        };
        window.addEventListener("pointerup", release, true);
        window.addEventListener("pointercancel", release, true);
      } else swallow();
      if (!landAt && drop && dropAt) onDropRef.current(id, dropAt);
    };
    const onUp = (ev: PointerEvent) => ev.pointerId === pointerId && finish(true);
    const onCancel = (ev: PointerEvent) => ev.pointerId === pointerId && finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && ghost) {
        ev.preventDefault();
        ev.stopPropagation();
        finish(false, true);
      }
    };

    // 드래그 중에는 터치 스크롤과 길게 누르기 메뉴를 막는다
    const onTouchMove = (te: TouchEvent) => ghost && te.preventDefault();
    const onContextMenu = (ce: Event) => longPress && ce.preventDefault();

    // 포인터 추적만 멈춘다. 고스트와 상태는 cleanup이 치운다
    function detach() {
      clearTimeout(pressTimer);
      cancelAnimationFrame(raf);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("contextmenu", onContextMenu);
    }
    function cleanup() {
      detach();
      clearTimeout(landTimer);
      ghost?.remove();
      ghost = null;
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

  return { dragId, target, height, onPointerDown };
}
