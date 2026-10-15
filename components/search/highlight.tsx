// 검색어와 일치하는 구간을 <mark>로 강조한다
import { splitHighlight } from "@/lib/search/text";

export function Highlight({ text, q }: { text: string; q: string }) {
  return splitHighlight(text, q).map((p, i) =>
    p.hit ? (
      <mark key={i} className="rounded-[2px] bg-(--accent-soft) text-(--text)">
        {p.text}
      </mark>
    ) : (
      p.text
    ),
  );
}
