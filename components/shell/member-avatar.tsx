// 이니셜 아바타. 멤버 색을 옅게 깔고 본문 글자색을 써서 모든 색에서 대비를 지킨다
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { colorHex } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

// 한글 이름은 첫 글자 하나, 로마자 이름은 단어 첫 글자 두 개
function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[A-Za-z]/.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  }
  return trimmed[0]!;
}

export function MemberAvatar({
  name,
  color,
  size = 24,
  online = false,
  className,
}: {
  name: string;
  color: string | null | undefined;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const hex = colorHex(color);
  return (
    // ui/avatar의 테두리 겹침(after)은 멤버 색 테두리와 겹치므로 끈다
    <Avatar className={cn("after:hidden", className)} style={{ width: size, height: size }}>
      <AvatarFallback
        aria-hidden
        className="font-semibold text-(--text)"
        style={{
          fontSize: Math.max(10, Math.round(size * 0.44)),
          background: `color-mix(in srgb, ${hex} 26%, var(--surface))`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hex} 40%, transparent)`,
        }}
      >
        {initials(name)}
      </AvatarFallback>
      {online && (
        <span
          role="img"
          aria-label="온라인"
          className="absolute -right-px -bottom-px size-2 rounded-full bg-(--green) ring-2 ring-(--bg-side)"
        />
      )}
    </Avatar>
  );
}
