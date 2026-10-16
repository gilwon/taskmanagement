"use client";
// 댓글 반응 칩과 반응 추가 팝오버. 칩은 개수와 누른 사람(툴팁)을 보이고, 댓글 권한이 있으면 눌러서 내 반응을 켜고 끈다
import { SmilePlus } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Reaction } from "@/lib/comments/queries";
import { useT } from "@/lib/i18n/client";
import { REACTION_EMOJIS } from "@/lib/i18n/labels";
import { motionOff } from "@/lib/prefs/prefs";
import { cn } from "@/lib/utils";
import "@/components/comments/lucian-comments.css";

type Emoji = (typeof REACTION_EMOJIS)[number];

type Props = {
  reactions: Reaction[];
  meId: string;
  nameOf: (id: string) => string | undefined;
  canReact: boolean;
  onToggle: (emoji: Emoji, on: boolean) => void;
};

export function Reactions({ reactions, meId, nameOf, canReact, onToggle }: Props) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  // 직전에 그린 이모지별 개수. 첫 그리기에는 비어 있어 튀지 않는다(5083f6a처럼 첫 로드는 가만히 둔다)
  const countsRef = useRef<Map<string, number> | null>(null);
  // 새로 생긴 칩과 개수가 바뀐 칩에 is-pop을 다시 붙여 튀게 한다(#077). Strict Mode의 두 번째 실행은 개수가 같아 건너뛴다.
  // 정리 함수로 클래스를 떼지 않는다. 낙관적 갱신 뒤 서버 응답이 개수 그대로 다시 그리면 도는 중인 튀기가 끊긴다
  useLayoutEffect(() => {
    const prev = countsRef.current;
    countsRef.current = new Map(reactions.map((r) => [r.emoji, r.userIds.length]));
    if (!prev || motionOff()) return;
    const changed = new Set<string>(reactions.filter((r) => prev.get(r.emoji) !== r.userIds.length).map((r) => r.emoji));
    const els = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-emoji]") ?? [])].filter((el) =>
      changed.has(el.dataset.emoji ?? ""),
    );
    for (const el of els) {
      el.classList.remove("is-pop");
      // 클래스를 뗀 상태를 한 번 계산시켜야 같은 애니메이션이 처음부터 다시 돈다
      void el.offsetWidth;
      el.classList.add("is-pop");
    }
  }, [reactions]);
  if (reactions.length === 0 && !canReact) return null;
  const mine = (r: Reaction) => r.userIds.includes(meId);
  const chip =
    "u077r-chip inline-flex h-(--h-xs) items-center gap-1 rounded-(--r-full) px-2 text-(length:--fs-xs) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)";

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const names = r.userIds.map((id) => (id === meId ? t("common.me") : (nameOf(id) ?? t("common.unknownUser")))).join(", ");
        const label = t("comments.reactionChip", { emoji: r.emoji, count: r.userIds.length, names });
        return (
          <Tooltip key={r.emoji}>
            <TooltipTrigger asChild>
              {canReact ? (
                <button
                  type="button"
                  data-emoji={r.emoji}
                  aria-pressed={mine(r)}
                  aria-label={label}
                  onClick={() => onToggle(r.emoji, !mine(r))}
                  className={chip}
                >
                  <span aria-hidden>{r.emoji}</span>
                  <span aria-hidden className="u077r-n font-mono">
                    {r.userIds.length}
                  </span>
                </button>
              ) : (
                <span tabIndex={0} data-emoji={r.emoji} aria-label={label} className={chip}>
                  <span aria-hidden>{r.emoji}</span>
                  <span aria-hidden className="u077r-n font-mono">
                    {r.userIds.length}
                  </span>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>{names}</TooltipContent>
          </Tooltip>
        );
      })}
      {canReact && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("comments.reactionAdd")}
              className="rounded-(--r-full) bg-(--surface-2) text-(--text-2) transition-colors hover:bg-(--surface-3) hover:text-(--text) aria-expanded:bg-(--surface-3) aria-expanded:text-(--text)"
            >
              <SmilePlus size={14} strokeWidth={1.8} aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-auto grid-cols-6 gap-0.5 p-1">
            {REACTION_EMOJIS.map((emoji) => {
              const on = reactions.find((r) => r.emoji === emoji)?.userIds.includes(meId) ?? false;
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={on}
                  aria-label={t("comments.reaction", { emoji })}
                  onClick={() => onToggle(emoji, !on)}
                  className={cn(
                    "u077r-e inline-flex size-(--h-md) items-center justify-center rounded-(--r-sm) text-(length:--fs-lg) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)",
                    on && "bg-(--accent-soft)",
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
