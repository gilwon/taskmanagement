"use client";
// 댓글 반응 칩과 반응 추가 팝오버. 칩은 개수와 누른 사람(툴팁)을 보이고, 댓글 권한이 있으면 눌러서 내 반응을 켜고 끈다
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Reaction } from "@/lib/comments/queries";
import { REACTION_EMOJIS, UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

type Emoji = (typeof REACTION_EMOJIS)[number];

type Props = {
  reactions: Reaction[];
  meId: string;
  nameOf: (id: string) => string | undefined;
  canReact: boolean;
  onToggle: (emoji: Emoji, on: boolean) => void;
};

export function Reactions({ reactions, meId, nameOf, canReact, onToggle }: Props) {
  if (reactions.length === 0 && !canReact) return null;
  const mine = (r: Reaction) => r.userIds.includes(meId);
  const chip =
    "inline-flex h-6 items-center gap-1 rounded-(--r-full) border px-2 text-(length:--fs-xs) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const names = r.userIds.map((id) => (id === meId ? "나" : (nameOf(id) ?? UNKNOWN_USER_LABEL))).join(", ");
        const label = `${r.emoji} 반응 ${r.userIds.length}개: ${names}`;
        return (
          <Tooltip key={r.emoji}>
            <TooltipTrigger asChild>
              {canReact ? (
                <button
                  type="button"
                  aria-pressed={mine(r)}
                  aria-label={label}
                  onClick={() => onToggle(r.emoji, !mine(r))}
                  className={cn(
                    chip,
                    mine(r)
                      ? "border-(--accent-line) bg-(--accent-soft) text-(--text)"
                      : "border-(--border) bg-(--surface) text-(--text-2) hover:bg-(--surface-2)",
                  )}
                >
                  <span aria-hidden>{r.emoji}</span>
                  <span aria-hidden className="font-mono">
                    {r.userIds.length}
                  </span>
                </button>
              ) : (
                <span tabIndex={0} aria-label={label} className={cn(chip, "border-(--border) text-(--text-2)")}>
                  <span aria-hidden>{r.emoji}</span>
                  <span aria-hidden className="font-mono">
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
            <Button type="button" variant="ghost" size="icon-xs" aria-label="반응 추가" className="text-(--text-3)">
              <SmilePlus size={14} strokeWidth={1.8} aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-auto gap-0.5 p-1">
            {REACTION_EMOJIS.map((emoji) => {
              const on = reactions.find((r) => r.emoji === emoji)?.userIds.includes(meId) ?? false;
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${emoji} 반응`}
                  onClick={() => onToggle(emoji, !on)}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-(--r-sm) text-base outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)",
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
