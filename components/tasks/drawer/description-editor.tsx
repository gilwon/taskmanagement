"use client";
// 작업 설명 편집기. contenteditable과 툴바(굵게·기울임·글머리·번호·제목·링크). 표시는 서버가 정제한 HTML만 넣고,
// 붙여넣기·끌어 놓기는 일반 텍스트로만 받으며 링크는 https만 허용한다. 최종 정제는 서버가 저장 시 한다(spec R13)
import { useEffect, useRef, useState } from "react";
import { Bold, Heading, Italic, Link2, List, ListOrdered, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { LINK_ERROR, validLink } from "@/components/tasks/drawer/rules";
import { cn } from "@/lib/utils";

// 툴바 버튼과 execCommand 명령. heading은 h3 ↔ p 전환이다
const TOOLS: { icon: LucideIcon; label: string; command: string }[] = [
  { icon: Bold, label: "굵게", command: "bold" },
  { icon: Italic, label: "기울임", command: "italic" },
  { icon: List, label: "글머리 기호 목록", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "번호 목록", command: "insertOrderedList" },
  { icon: Heading, label: "제목", command: "heading" },
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const BLOCKS = new Set(["P", "UL", "OL", "H3"]);

// 글자가 없으면 빈 설명(null)으로 본다. 빈 편집기에 바로 친 첫 줄처럼 문단 밖에 놓인 글자·인라인 요소는 p로 감싼다.
// 그대로 두면 서버 정제 뒤 다음 문단과 한 줄로 붙는다
function serialize(el: HTMLElement): string | null {
  if (!el.textContent?.trim()) return null;
  const out = document.createElement("div");
  let para: HTMLElement | null = null;
  for (const node of el.childNodes) {
    if (node instanceof HTMLElement && (BLOCKS.has(node.tagName) || node.tagName === "DIV")) {
      para = null;
      // 크롬이 만든 div 문단은 p로 바꾼다
      if (node.tagName !== "DIV") {
        out.append(node.cloneNode(true));
        continue;
      }
      const p = document.createElement("p");
      p.append(...[...node.childNodes].map((c) => c.cloneNode(true)));
      out.append(p);
    } else {
      if (!para) out.append((para = document.createElement("p")));
      para.append(node.cloneNode(true));
    }
  }
  return out.innerHTML;
}

type Props = {
  // 서버가 정제한 설명 HTML
  html: string | null;
  // 바뀌면 편집 중이어도 내용을 새로 채운다(다른 작업으로 전환)
  resetKey: string;
  onCommit?: (html: string | null) => void;
  onChange?: (html: string | null) => void;
  disabled?: boolean;
  className?: string;
};

export function DescriptionEditor({ html, resetKey, onCommit, onChange, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const lastKey = useRef<string | null>(null);
  // 포커스를 받을 때의 내용. 바뀌지 않았으면 blur에 저장하지 않는다. null이면 편집 중이 아니다
  const atFocus = useRef<string | null | undefined>(undefined);
  const commitRef = useRef(onCommit);
  const [empty, setEmpty] = useState(!html);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    commitRef.current = onCommit;
  });

  // 편집 중에 다른 작업으로 바뀌거나 사라지면(드로어 닫기) blur를 기다리지 않고 저장한다.
  // 정리 함수는 아래 내용 교체보다 먼저 돌아 이전 작업의 내용과 저장 함수를 쓴다
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (!el || atFocus.current === undefined) return;
      const next = serialize(el);
      const before = atFocus.current;
      atFocus.current = undefined;
      if (next !== before) commitRef.current?.(next);
    };
  }, [resetKey]);

  // 서버 확정값은 편집 중이 아닐 때만 반영해 입력·커서를 덮지 않는다. 작업이 바뀌면 바로 반영한다
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const switched = lastKey.current !== resetKey;
    lastKey.current = resetKey;
    if (!switched && document.activeElement === el) return;
    el.innerHTML = html ?? "";
    setEmpty(!el.textContent?.trim());
  }, [html, resetKey]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    const el = ref.current;
    if (el) {
      setEmpty(!el.textContent?.trim());
      onChange?.(serialize(el));
    }
  };

  const toggleHeading = () => {
    const current = String(document.queryCommandValue("formatBlock")).toLowerCase();
    exec("formatBlock", current === "h3" ? "p" : "h3");
  };

  const openLink = () => {
    const sel = window.getSelection();
    range.current =
      sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl("");
    setLinkError(false);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = validLink(linkUrl);
    if (!url) return setLinkError(true);
    setLinkOpen(false);
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && range.current) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
    // 선택한 글자가 없으면 주소를 글자로 넣는다
    if (!range.current || range.current.collapsed) exec("insertHTML", `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    else exec("createLink", url);
  };


  const insertPlain = (text: string) => exec("insertText", text);

  return (
    <div className={cn("rounded-(--r) border border-(--border) bg-(--surface) focus-within:border-(--border-strong)", className)}>
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <div role="toolbar" aria-label="설명 서식" className="flex items-center gap-0.5 border-b border-(--divider) px-1 py-1">
          {TOOLS.map(({ icon: Icon, label, command }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              disabled={disabled}
              className="text-(--text-3) hover:text-(--text)"
              // 버튼을 눌러도 편집기 선택이 풀리지 않게 한다
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (command === "heading" ? toggleHeading() : exec(command))}
            >
              <Icon size={14} strokeWidth={1.8} aria-hidden />
            </Button>
          ))}
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="링크"
              aria-expanded={linkOpen}
              disabled={disabled}
              className="text-(--text-3) hover:text-(--text)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openLink}
            >
              <Link2 size={14} strokeWidth={1.8} aria-hidden />
            </Button>
          </PopoverAnchor>
        </div>
        <PopoverContent align="start" className="w-72 p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
            className="flex flex-col gap-1.5"
          >
            <label htmlFor={`link-${resetKey}`} className="text-(length:--fs-xs) text-(--text-3)">
              링크 주소
            </label>
            <div className="flex gap-1.5">
              <Input
                id={`link-${resetKey}`}
                value={linkUrl}
                placeholder="https://"
                inputMode="url"
                aria-invalid={linkError}
                aria-describedby={linkError ? `link-err-${resetKey}` : undefined}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(false);
                }}
                className="h-(--h-sm) text-(length:--fs-sm)"
              />
              <Button type="submit" size="sm">
                넣기
              </Button>
            </div>
            {linkError && (
              <p id={`link-err-${resetKey}`} role="alert" className="text-(length:--fs-xs) text-(--red)">
                {LINK_ERROR}
              </p>
            )}
          </form>
        </PopoverContent>
      </Popover>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="설명"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-empty={empty || undefined}
        data-placeholder="설명 추가…"
        className="task-description min-h-24 px-3 py-2 text-(length:--fs-base) leading-relaxed text-(--text) outline-none data-empty:before:pointer-events-none data-empty:before:text-(--text-4) data-empty:before:content-[attr(data-placeholder)] [&_a]:text-(--accent) [&_a]:underline [&_h3]:my-1 [&_h3]:text-(length:--fs-md) [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
        onFocus={(e) => {
          atFocus.current = serialize(e.currentTarget);
          // 크롬은 Enter에 div를 만든다. 허용 태그(p)로 문단을 나눈다
          document.execCommand("defaultParagraphSeparator", false, "p");
        }}
        onInput={(e) => {
          setEmpty(!e.currentTarget.textContent?.trim());
          onChange?.(serialize(e.currentTarget));
        }}
        onBlur={(e) => {
          if (atFocus.current === undefined) return;
          const next = serialize(e.currentTarget);
          const before = atFocus.current;
          atFocus.current = undefined;
          if (next !== before) onCommit?.(next);
        }}
        onPaste={(e) => {
          e.preventDefault();
          insertPlain(e.clipboardData.getData("text/plain"));
        }}
        onDrop={(e) => {
          e.preventDefault();
          insertPlain(e.dataTransfer.getData("text/plain"));
        }}
      />
    </div>
  );
}
