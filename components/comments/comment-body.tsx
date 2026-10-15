// 댓글 본문. 사용자 입력이라 HTML로 해석하지 않고 텍스트로만 그리며 @멘션만 강조한다
import { splitMentions, type MentionMember } from "@/lib/comments/mentions";

export function CommentBody({ body, members }: { body: string; members: MentionMember[] }) {
  return (
    <p className="text-(length:--fs-base) leading-relaxed break-words whitespace-pre-wrap text-(--text)">
      {splitMentions(body, members).map((s, i) =>
        s.memberId ? (
          <span key={i} className="rounded-(--r-xs) bg-(--accent-soft) px-0.5 font-medium text-(--accent)">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}
