// 댓글 @멘션 순수 함수. 작성 중인 멘션 찾기, 고른 구성원 넣기, 본문의 멘션 조각 나누기와 멘션 대상 id 뽑기
// 본문에는 "@이름"만 남긴다. 알림 발췌(snippet)가 본문을 그대로 쓰므로 id 같은 표시를 넣지 않고 id는 따로 보낸다

export type MentionMember = { id: string; name: string };

// 커서 바로 앞의 "@검색어". @ 앞은 줄 처음이나 공백이어야 하고 검색어에는 공백·@가 없다
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}

// start(@ 위치)부터 caret까지를 "@이름 "으로 바꾼다. 새 본문과 새 커서 위치를 돌려준다
export function insertMention(text: string, start: number, caret: number, name: string) {
  const insert = `@${name} `;
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length };
}

// 자동완성 후보. 이름에 검색어가 들어간 구성원(대소문자 무시)
export function filterMentionCandidates<T extends MentionMember>(members: T[], query: string, limit = 6): T[] {
  const q = query.toLowerCase();
  return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, limit);
}

export type MentionSegment = { text: string; memberId?: string };

// 이름 바로 뒤에 오면 이름의 일부로 보는 글자. 라틴 문자·숫자·밑줄(@Ann이 @Annabel에 걸리지 않게). 한글 조사(@김지윤님께)는 허용한다
const NAME_CONTINUES = /[A-Za-z0-9_]/;

// 본문을 일반 글과 멘션 조각으로 나눈다. @ 앞은 줄 처음이나 공백이어야 하고, 같은 자리에서는 긴 이름을 먼저 맞추며(김지 < 김지윤)
// 이름 바로 뒤가 NAME_CONTINUES면 그 이름으로 보지 않는다.
// shortcut: 이름으로만 찾으므로 구성원이 이름을 바꾸면 옛 댓글의 멘션은 강조되지 않는다. 댓글에 멘션 id를 저장하게 되면 그 값으로 바꾼다
export function splitMentions(text: string, members: MentionMember[]): MentionSegment[] {
  const names = members.filter((m) => m.name).sort((a, b) => b.name.length - a.name.length);
  const out: MentionSegment[] = [];
  let buf = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "@" && (i === 0 || /\s/.test(text[i - 1]))) {
      const hit = names.find((m) => {
        const end = i + 1 + m.name.length;
        return text.startsWith(m.name, i + 1) && !NAME_CONTINUES.test(text[end] ?? "");
      });
      if (hit) {
        if (buf) out.push({ text: buf });
        buf = "";
        out.push({ text: `@${hit.name}`, memberId: hit.id });
        i += hit.name.length + 1;
        continue;
      }
    }
    buf += text[i];
    i += 1;
  }
  if (buf) out.push({ text: buf });
  return out;
}

// 본문에서 멘션한 구성원 id(중복 없이, 나온 순서대로). add_comment의 p_mentions로 보낸다
export function mentionIds(text: string, members: MentionMember[]): string[] {
  const ids = splitMentions(text, members).flatMap((s) => (s.memberId ? [s.memberId] : []));
  return [...new Set(ids)];
}
