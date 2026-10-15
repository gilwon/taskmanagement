// 사전 밖에 남은 한국어 화면 문구를 센다. app·components·lib의 .ts/.tsx에서 문자열·템플릿·JSX 텍스트에 한글이 든 것을 파일별로 보인다.
// 주석·*.test.*·database.types·lib/i18n/messages는 뺀다. 지금은 보고용이라 항상 종료 코드 0이다(0개가 되면 CI용으로 바꾼다).
// 사용법: node scripts/check-i18n.mjs [--all]  (--all이면 줄 번호와 문구까지 보인다)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['app', 'components', 'lib'];
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const showAll = process.argv.includes('--all');

const skip = (rel) =>
  /\.test\.tsx?$/.test(rel) || rel === join('lib', 'database.types.ts') || rel.startsWith(join('lib', 'i18n', 'messages') + sep);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name)) yield full;
  }
}

// 토큰 단위로 훑으므로 주석은 저절로 빠진다
function findKorean(file) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits = [];
  const visit = (node) => {
    const k = node.kind;
    if (
      k === ts.SyntaxKind.StringLiteral ||
      k === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
      k === ts.SyntaxKind.TemplateHead ||
      k === ts.SyntaxKind.TemplateMiddle ||
      k === ts.SyntaxKind.TemplateTail ||
      k === ts.SyntaxKind.JsxText
    ) {
      const value = node.text ?? node.getText(source);
      if (HANGUL.test(value)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        hits.push({ line: line + 1, value: value.trim().replace(/\s+/g, ' ') });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

const perFile = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (skip(rel)) continue;
    const hits = findKorean(file);
    if (hits.length) perFile.push({ rel, hits });
  }
}

perFile.sort((a, b) => b.hits.length - a.hits.length || a.rel.localeCompare(b.rel));
for (const { rel, hits } of perFile) {
  console.log(`${String(hits.length).padStart(4)}  ${rel}`);
  if (showAll) for (const h of hits) console.log(`        ${h.line}: ${h.value}`);
}

// 영역(app/[ws]/tasks → app/[ws]/tasks, components/tasks/drawer → components/tasks)별 합계
const byArea = new Map();
for (const { rel, hits } of perFile) {
  const parts = rel.split(sep);
  const area = parts[0] === 'app' && parts[1] === '[ws]' ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
  byArea.set(area, (byArea.get(area) ?? 0) + hits.length);
}
console.log('\n영역별');
for (const [area, n] of [...byArea].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${area}`);

const total = perFile.reduce((n, f) => n + f.hits.length, 0);
console.log(`\n합계 ${total}개 (${perFile.length}개 파일)`);
