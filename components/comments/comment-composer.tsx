"use client";
// 댓글 입력창. Enter는 줄바꿈, ⌘/Ctrl+Enter는 보내기. @를 치면 구성원 자동완성 목록(listbox)을 띄운다.
// Esc는 멘션 목록 → 입력창(편집 취소 또는 포커스 해제) 순서로 하나씩 닫는다. 드로어는 data-esc-local이 붙은 입력창의 Esc로 닫히지 않는다
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { activeMention, filterMentionCandidates, insertMention, mentionIds } from "@/lib/comments/mentions";
import { cn } from "@/lib/utils";

export type ComposerMember = { id: string; name: string; color: string; title?: string | null };

type Props = {
  members: ComposerMember[];
  // 접근성 이름
  label: string;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  // 성공하면 true. 새 댓글 입력창은 성공 후 비운다
  onSubmit: (body: string, mentions: string[]) => Promise<boolean>;
  // 있으면 취소 버튼과 Esc가 이것을 부른다(댓글 편집)
  onCancel?: () => void;
};

export function CommentComposer({
  members,
  label,
  placeholder = "댓글을 남기세요… @로 구성원을 멘션할 수 있습니다",
  submitLabel = "보내기",
  initialValue = "",
  autoFocus,
  onSubmit,
  onCancel,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialValue);
  const [caret, setCaret] = useState(initialValue.length);
  const [active, setActive] = useState(0);
  // Esc로 닫은 멘션의 @ 위치. 같은 @에서는 다시 띄우지 않는다
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const mention = activeMention(value, caret);
  const candidates = mention && mention.start !== dismissed ? filterMentionCandidates(members, mention.query) : [];
  const open = candidates.length > 0;
  const current = open ? candidates[Math.min(active, candidates.length - 1)] : undefined;

  const sync = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart ?? el.value.length);
  };

  const pick = (name: string) => {
    if (!mention) return;
    const next = insertMention(value, mention.start, caret, name);
    setValue(next.text);
    setCaret(next.caret);
    setActive(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = async () => {
    const body = value.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSubmit(body, mentionIds(body, members));
    setBusy(false);
    if (ok && !onCancel) {
      setValue("");
      setCaret(0);
      setDismissed(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (Math.min(i, candidates.length - 1) + step + candidates.length) % candidates.length);
        return;
      }
      if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
        e.preventDefault();
        if (current) pick(current.name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(mention!.start);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (onCancel) onCancel();
      else e.currentTarget.blur();
    }
  };

  const listId = `${id}-mentions`;
  const optionId = (memberId: string) => `${id}-m-${memberId}`;

  return (
    <div className="relative flex flex-col gap-2">
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="멘션할 구성원"
          className="absolute bottom-full left-0 z-10 mb-1 max-h-60 w-64 max-w-full overflow-y-auto rounded-(--r) border border-(--border) bg-(--surface) p-1 shadow-(--shadow-pop)"
        >
          {candidates.map((m) => (
            <li
              key={m.id}
              id={optionId(m.id)}
              role="option"
              aria-selected={m.id === current?.id}
              // 입력창 포커스를 잃지 않게 mousedown 기본 동작을 막는다
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m.name)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-(--r-sm) px-2 py-1.5 text-(length:--fs-sm) text-(--text)",
                m.id === current?.id ? "bg-(--surface-2)" : "hover:bg-(--surface-2)",
              )}
            >
              <MemberAvatar name={m.name} color={m.color} size={20} />
              <span className="truncate">{m.name}</span>
              {m.title && <span className="ml-auto truncate text-(length:--fs-xs) text-(--text-3)">{m.title}</span>}
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={ref}
        // 드로어 Esc 순서. 이 입력창 안의 Esc는 드로어를 닫지 않는다(task-drawer-host)
        data-esc-local=""
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={current ? optionId(current.id) : undefined}
        value={value}
        rows={2}
        maxLength={10_000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => {
          setValue(e.target.value);
          sync(e.target);
          setActive(0);
        }}
        onSelect={(e) => sync(e.currentTarget)}
        onKeyDown={onKeyDown}
        className="field-sizing-content max-h-60 min-h-16 w-full resize-none rounded-(--r) border border-(--border) bg-(--surface) px-3 py-2 text-(length:--fs-base) text-(--text) outline-none placeholder:text-(--text-4) focus-visible:border-(--accent) focus-visible:ring-2 focus-visible:ring-(--accent)/30 disabled:opacity-60"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-(length:--fs-xs) text-(--text-4) max-[480px]:hidden">⌘/Ctrl+Enter로 보내기</span>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !value.trim()} aria-busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
