// 목록 안 하이라이트 막대가 미끄러질 위치를 재서 CSS 변수로 붙이는 훅
//
// 사용법.
//   function List({ ref, ...props }: React.ComponentProps<"div">) {
//     const listRef = useGlide(ref, { axis: "y" }); // 호출부 ref와 합친 ref를 돌려준다
//     return <div ref={listRef} {...props}><span className="bar" aria-hidden />…</div>;
//   }
//   // 목록(position relative)에 data-glide와 --glide-y·--glide-h가 붙는다(axis "x"면 --glide-x·--glide-w, "both"면 넷 다)
//   // .bar { transform: translateY(var(--glide-y)); height: var(--glide-h) }  [data-glide] 없으면 숨긴다
//   // [data-glide-live] .bar { transition: transform … }  전환은 이 속성이 있을 때만 건다
// 대상은 포커스된 항목이 먼저, 없으면 선택된 항목(data-selected=true·aria-selected=true·data-state=active).
// 첫 자리, 항목이 더해지거나 빠질 때, 크기가 바뀔 때는 data-glide-live를 한 프레임 떼어 전환 없이 자리만 잡는다.
// 선택만 옮겨질 때(화살표·포인터·클릭)는 data-glide-live가 남아 있어 미끄러진다.

import { useCallback, useLayoutEffect, useRef, type Ref } from "react";

const ITEM = "[role=option],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[cmdk-item]";
const SELECTED = "[data-selected=true],[aria-selected=true],[data-state=active]";

export type GlideOptions = {
  axis?: "x" | "y" | "both";
};

// 호출부 ref에 요소를 넘긴다. 함수 ref와 객체 ref 둘 다 받는다
function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

export function useGlide<T extends HTMLElement>(ref: Ref<T> | undefined, options: GlideOptions = {}) {
  const { axis = "y" } = options;
  const listRef = useRef<T | null>(null);
  // 호출부 ref도 같은 요소를 받게 잇는다
  const setRef = useCallback(
    (node: T | null) => {
      listRef.current = node;
      assignRef(ref, node);
    },
    [ref]
  );
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    // 전환을 떼고 지금 값으로 한 번 그린 뒤, 다음 프레임에 전환을 다시 켠다
    const settle = () => {
      delete list.dataset.glideLive;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void list.offsetWidth;
        list.dataset.glideLive = "";
      });
    };
    const update = (instant: boolean) => {
      const active = document.activeElement;
      const focused = active && active !== list && list.contains(active) ? active.closest<HTMLElement>(ITEM) : null;
      const target = (focused && list.contains(focused) ? focused : null) ?? list.querySelector<HTMLElement>(SELECTED);
      if (!target) {
        delete list.dataset.glide;
        delete list.dataset.glideLive;
        cancelAnimationFrame(frame);
        return;
      }
      // 숨어 있던 막대가 처음 나타날 때도 빈자리에서 미끄러져 오지 않게 바로 잡는다
      if (instant || list.dataset.glide === undefined) settle();
      list.dataset.glide = "";
      if (axis !== "x") {
        list.style.setProperty("--glide-y", `${target.offsetTop}px`);
        list.style.setProperty("--glide-h", `${target.offsetHeight}px`);
      }
      if (axis !== "y") {
        list.style.setProperty("--glide-x", `${target.offsetLeft}px`);
        list.style.setProperty("--glide-w", `${target.offsetWidth}px`);
      }
    };
    // 목록과 항목 크기를 본다. 탭 글자·개수가 바뀌어 폭이 달라져도 따라간다
    const ro = new ResizeObserver(() => update(true));
    const observeAll = () => {
      ro.disconnect();
      ro.observe(list);
      list.querySelectorAll(ITEM).forEach((el) => ro.observe(el));
    };
    observeAll();
    update(true);
    const onFocus = () => update(false);
    // focusout 중에는 activeElement가 body라 선택 항목으로 돌아가고, 목록 안 다른 항목이면 이어지는 focusin이 다시 잰다
    list.addEventListener("focusin", onFocus);
    list.addEventListener("focusout", onFocus);
    // 항목이 더해지거나 빠지면(검색 입력으로 목록이 다시 그려지면) 바로 잡고, 선택 속성만 바뀌면 미끄러진다
    const mo = new MutationObserver((records) => {
      const changed = records.some((r) => r.type === "childList");
      if (changed) observeAll();
      update(changed);
    });
    mo.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-selected", "aria-selected", "data-state"] });
    return () => {
      cancelAnimationFrame(frame);
      list.removeEventListener("focusin", onFocus);
      list.removeEventListener("focusout", onFocus);
      mo.disconnect();
      ro.disconnect();
    };
  }, [axis]);
  return setRef;
}
