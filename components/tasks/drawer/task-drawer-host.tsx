"use client";
// 태스크 드로어. ?task={KEY}로 열리는 우측 패널(약 620px, 640px 이하 전체 화면)에 TaskDetailPanel을 띄운다.
// TaskStoreProvider 안에 두며, store에 없는 작업은 서버에서 읽어 잠시 빌려 넣고 닫을 때 뺀다
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog as SheetPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { fetchTaskByKey } from "@/components/tasks/drawer/actions";
import { neighbors } from "@/components/tasks/drawer/rules";
import { TaskDetailPanel } from "@/components/tasks/drawer/task-detail-panel";
import { useNewTaskTarget } from "@/components/tasks/new-task/launcher";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { useT } from "@/lib/i18n/client";
import "@/components/tasks/drawer/lucian-drawer.css";

const SMALL = "(max-width: 640px)";

function useSmallScreen() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SMALL);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(SMALL).matches,
    () => false,
  );
}

// 드로어에서 전체 페이지로 넘어간 키. 전체 페이지의 "사이드 패널로 보기"가 뒤로 가기로 돌아올지 정한다.
// 클라이언트 이동 동안만 남고 새로고침하면 비워진다. 작업 키는 워크스페이스마다 겹칠 수 있어 slug와 함께 둔다
let expandedKey: string | null = null;
export function cameFromDrawer(ws: string, key: string) {
  return expandedKey === `${ws}/${key}`;
}

// order는 지금 보기에 보이는 작업 키 순서. 주면 서랍 머리에 이전·다음 이동(버튼·J/K)이 생긴다
export function TaskDrawerHost({ order }: { order?: readonly string[] }) {
  // useSearchParams를 쓰므로 정적 렌더 경계를 둔다
  return (
    <Suspense fallback={null}>
      <Host order={order} />
    </Suspense>
  );
}

type Fetched = { key: string; status: "loading" | "missing" | "error"; error?: string };

function Host({ order }: { order?: readonly string[] }) {
  const t = useT();
  const router = useRouter();
  const { openKey, open, close } = useTaskDrawer();
  const { items, workspace } = useTasks();
  const actions = useTaskActions();
  const small = useSmallScreen();
  const item = openKey ? items.find((t) => t.key === openKey) : undefined;
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [retry, setRetry] = useState(0);
  // 서버에서 읽어 store에 잠시 넣은 작업 id
  const borrowed = useRef(new Set<string>());
  const opener = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const escRef = useRef<(() => boolean) | null>(null);
  const announced = useRef<string | null>(null);
  // 이전·다음으로 바꾼 참이면 제목으로 포커스를 옮기지 않는다. 옮기면 다음 J/K가 제목 입력으로 들어간다
  const stepping = useRef(false);

  useNewTaskTarget(useMemo(() => ({ create: actions.create, open }), [actions.create, open]));

  // 닫을 때 포커스를 돌려줄 곳. 연 요소가 사라졌으면 본문으로 보낸다
  const restoreFocus = useCallback(() => {
    const target = opener.current?.isConnected ? opener.current : document.getElementById("main-content");
    target?.focus();
  }, []);

  // 연 요소는 드로어가 포커스를 가져가기 전에 기억한다(레이아웃 효과가 Radix 포커스보다 먼저 돈다)
  const wasOpen = useRef(false);
  const asideRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (openKey && !wasOpen.current) {
      const active = document.activeElement as HTMLElement | null;
      opener.current = active && active !== document.body ? active : null;
    } else if (!openKey && wasOpen.current) {
      // 닫히면 패널 내용이 바로 바뀌어 포커스가 body로 떨어진다. 닫힘 애니메이션이 끝날 때까지 기다리지 않고 지금 돌려준다
      const active = document.activeElement;
      if (!active || active === document.body || asideRef.current?.contains(active)) restoreFocus();
    }
    wasOpen.current = !!openKey;
  }, [openKey, restoreFocus]);

  // store에 없는 작업은 서버에서 읽는다
  const missing = !!openKey && !item;
  useEffect(() => {
    if (!missing || !openKey) return;
    let alive = true;
    void fetchTaskByKey(workspace.id, openKey).then((r) => {
      if (!alive) return;
      if (!r.ok) return setFetched({ key: openKey, status: "error", error: r.error });
      if (!r.data) return setFetched({ key: openKey, status: "missing" });
      borrowed.current.add(r.data.id);
      actions.upsertLocal(r.data);
      setFetched(null);
    });
    return () => {
      alive = false;
    };
  }, [missing, openKey, workspace.id, actions, retry]);

  // 다른 작업으로 바꾸거나 닫으면 빌린 작업을 store에서 뺀다
  const { removeLocal } = actions;
  const currentId = item?.id;
  useEffect(() => {
    for (const id of borrowed.current) {
      if (id === currentId) continue;
      borrowed.current.delete(id);
      removeLocal(id);
    }
  }, [currentId, removeLocal]);

  // 스크린 리더에 연 작업을 알리고 제목으로 포커스를 옮긴다(서버에서 늦게 읽은 작업, 다른 작업으로 전환 포함)
  useEffect(() => {
    if (!item) {
      if (!openKey) announced.current = null;
      // 서버에서 읽는 경로로 빠지면 이동 표시를 지운다. 남으면 다음 일반 열기에서 제목 포커스를 건너뛴다
      stepping.current = false;
      return;
    }
    if (announced.current === item.key) return;
    announced.current = item.key;
    const live = document.getElementById("sr-live");
    if (live) live.textContent = t("tasks.drawer.opened", { key: item.key, title: item.title });
    if (!stepping.current) titleRef.current?.focus();
    stepping.current = false;
  }, [item, openKey, t]);

  const expand = useCallback(() => {
    if (!item) return;
    expandedKey = `${workspace.slug}/${item.key}`;
    router.push(`/${workspace.slug}/task/${item.key}`);
  }, [item, router, workspace.slug]);

  // 이전·다음 이동. 앞뒤 키가 바뀔 때만 새로 만들어 패널의 J/K 리스너가 렌더마다 다시 붙지 않게 한다
  const near = order && openKey ? neighbors(order, openKey) : null;
  const hasNav = !!near;
  const prevKey = near?.prev ?? null;
  const nextKey = near?.next ?? null;
  const nav = useMemo(() => {
    if (!hasNav) return undefined;
    return {
      prev: !!prevKey,
      next: !!nextKey,
      go: (dir: "prev" | "next") => {
        const key = dir === "prev" ? prevKey : nextKey;
        if (!key) return;
        stepping.current = true;
        open(key);
      },
    };
  }, [hasNav, prevKey, nextKey, open]);

  const state = openKey && !item && fetched?.key === openKey ? fetched : null;

  return (
    <Sheet modal={small} open={!!openKey} onOpenChange={(next) => !next && close()}>
      {/* shadcn SheetContent는 닫기 버튼을 함께 그려 aside 하나로 감쌀 수 없어 Radix 원형으로 aside를 드로어로 쓴다 */}
      <SheetPrimitive.Portal>
        {small && <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-(--overlay)" />}
        <SheetPrimitive.Content
          asChild
          aria-describedby={undefined}
          aria-modal={small || undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            // 닫힐 때 이미 돌려줬다. 그 사이 사용자가 다른 곳으로 옮겼으면 건드리지 않는다
            const active = document.activeElement;
            if (!active || active === document.body) restoreFocus();
          }}
          // 사이드 패널일 때는 목록을 계속 쓸 수 있어 바깥 클릭·포커스로 닫지 않는다
          onInteractOutside={(e) => {
            if (!small) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // 댓글 입력창은 Esc를 스스로 처리한다(멘션 → 입력창). Radix가 캡처 단계에서 먼저 받으므로 여기서 거른다
            if (e.target instanceof Element && e.target.closest("[data-esc-local]")) return e.preventDefault();
            if (escRef.current?.()) e.preventDefault();
          }}
        >
        <aside ref={asideRef} className="u273-pn fixed inset-y-0 right-0 z-50 flex h-full w-[620px] max-w-full flex-col border-l border-(--border) bg-(--surface) shadow-(--shadow-pop) outline-none max-[640px]:w-full max-[640px]:border-l-0">
          <SheetTitle className="sr-only">{item ? `${item.key} ${item.title}` : (openKey ?? t("tasks.drawer.fallbackTitle"))}</SheetTitle>
          {item ? (
            <TaskDetailPanel
              task={item}
              mode="drawer"
              titleRef={titleRef}
              escRef={escRef}
              onClose={close}
              onToggleLayout={expand}
              onOpenTask={open}
              nav={nav}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              {state?.status === "missing" || state?.status === "error" ? (
                <>
                  <p role="alert" className="text-(length:--fs-base) text-(--text-2)">
                    {state.status === "missing" ? t("tasks.errors.notFound") : state.error}
                  </p>
                  <div className="flex gap-2">
                    {state.status === "error" && (
                      <Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>
                        {t("tasks.drawer.retry")}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={close}>
                      {t("tasks.drawer.close")}
                    </Button>
                  </div>
                </>
              ) : (
                <p aria-busy="true" className="text-(length:--fs-sm) text-(--text-3)">
                  {t("tasks.drawer.loading")}
                </p>
              )}
            </div>
          )}
        </aside>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
