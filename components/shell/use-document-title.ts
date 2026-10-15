// metadata를 쓸 수 없는 404 화면에서 문서 제목을 고정하는 훅. 다른 title이 앞서 들어오거나 바뀌면 다시 맞춘다
import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const fix = () => {
      if (document.title !== title) document.title = title;
    };
    // head의 직계 자식(title 추가·제거)과 지금 문서 제목을 정하는 첫 title 요소의 글자만 본다
    const watchTitle = () => {
      const el = document.querySelector("title");
      if (el) mo.observe(el, { childList: true, characterData: true, subtree: true });
    };
    const mo = new MutationObserver(() => {
      fix();
      watchTitle();
    });
    fix();
    mo.observe(document.head, { childList: true });
    watchTitle();
    return () => mo.disconnect();
  }, [title]);
}
