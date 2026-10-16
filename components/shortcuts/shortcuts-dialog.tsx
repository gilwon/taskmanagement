"use client";
// 키보드 단축키 모달(? 키, 도움말 메뉴, 커맨드 팔레트). 목록은 SHORTCUT_GROUPS 하나에서 가져온다
import { useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUT_GROUPS, keyLabel, type ShortcutItem } from "@/components/shortcuts/shortcut-list";
import { useT } from "@/lib/i18n/client";

// 서버 렌더에서는 Ctrl로 두고 브라우저에서 macOS면 ⌘로 바꾼다
const subscribeNone = () => () => {};
export function useIsMac() {
  return useSyncExternalStore(
    subscribeNone,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

const kbd =
  "inline-flex h-(--h-xs) min-w-(--h-xs) items-center justify-center rounded-(--r-xs) border border-(--border) bg-(--surface-2) px-1.5 font-mono text-(length:--fs-2xs) text-(--text-2)";

export function ShortcutKeys({ item, mac }: { item: ShortcutItem; mac: boolean }) {
  const t = useT();
  const combo = (keys: string[]) => keys.map((k) => keyLabel(k, mac)).join(" + ");
  return (
    <span className="flex shrink-0 items-center gap-1" aria-label={item.then ? t("shortcuts.thenLabel", { first: combo(item.keys), second: combo(item.then) }) : combo(item.keys)}>
      {item.keys.map((k) => (
        <kbd key={k} aria-hidden className={kbd}>
          {keyLabel(k, mac)}
        </kbd>
      ))}
      {item.then && (
        <>
          <span aria-hidden className="text-(length:--fs-2xs) text-(--text-4)">
            {t("shortcuts.then")}
          </span>
          {item.then.map((k) => (
            <kbd key={k} aria-hidden className={kbd}>
              {keyLabel(k, mac)}
            </kbd>
          ))}
        </>
      )}
    </span>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const t = useT();
  const mac = useIsMac();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[min(640px,calc(100dvh-2rem))] gap-0 overflow-y-auto p-0 sm:max-w-[560px]"
      >
        <div className="border-b border-(--border) px-5 py-4">
          <DialogTitle className="text-(length:--fs-md) font-semibold text-(--text)">{t("shortcuts.title")}</DialogTitle>
          <DialogDescription className="mt-1 text-(length:--fs-sm) text-(--text-3)">
            {t("shortcuts.dialogHint")}
          </DialogDescription>
        </div>
        <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`shortcut-group-${g.title}`}>
              <h3 id={`shortcut-group-${g.title}`} className="mb-1.5 text-(length:--fs-2xs) font-medium text-(--text-3)">
                {t(g.title)}
              </h3>
              <ul className="space-y-1">
                {g.items.map((item) => (
                  <li key={item.label} className="flex min-h-(--h-sm) items-center justify-between gap-3">
                    <span className="min-w-0 text-(length:--fs-sm) text-(--text-2)">{t(item.label)}</span>
                    <ShortcutKeys item={item} mac={mac} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
