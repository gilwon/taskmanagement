// 개발 시드의 files 행마다 작은 실제 파일을 로컬 Storage에 올리고, 성공한 행만 ready로 바꾼다.
// 실패한 행은 failed로 두고 종료 코드 1로 끝낸다. 로컬 스택 전용이다.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SEED_SLUGS = ['hanbit', 'dalbit', 'byeol'];

// 1x1 투명 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// 빈 페이지 한 장짜리 PDF. xref 오프셋을 실제 위치로 계산한다(ASCII만 써서 글자 수 = 바이트 수).
function pdf(title) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] >>',
    `<< /Title (${title}) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'ascii');
}

// 빈 ZIP(중앙 디렉터리 끝 레코드만 있는 22바이트)
const EMPTY_ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]);

const text = (s) => Buffer.from(s, 'utf8');

// files.object_name → 올릴 내용. dev.sql의 size_bytes가 이 버퍼 길이와 같아야 한다.
// name은 한글 표시용 원본 이름이라 판정에 쓰지 않는다. MIME은 행의 mime을 그대로 쓴다.
const CONTENTS = {
  'homepage-hero-v3.fig': text('fig-kiwi\n개발 시드용 Figma 자리표시 파일\n'),
  'brand-guidelines.pdf': pdf('Brand guidelines'),
  'hero-banner.png': PNG,
  'icon-assets.zip': EMPTY_ZIP,
  'content-calendar.csv': text('날짜,채널,주제\n2026-10-20,블로그,리디자인 소개\n2026-10-27,뉴스레터,신규 기능\n'),
  'kickoff-notes.txt': text('킥오프 회의록\n- 목표 확인\n- 일정 공유\n'),
  'auth-api-schema.json': text('{"openapi":"3.1.0","info":{"title":"auth","version":"0.1.0"},"paths":{}}\n'),
  'app-icon.png': PNG,
  'launch-checklist.pdf': pdf('Launch checklist'),
  'release-notes.txt': text('릴리스 노트 초안\n- 결제 오류 수정\n'),
  'design-tokens.json': text('{"color":{"accent":"#4b5bd6","border":"#e9e7e2"},"radius":{"sm":6,"md":8}}\n'),
  'research-memo.md': text('# 인터뷰 메모\n\n- 참가자 5명\n- 주요 불편: 검색\n'),
};

function localEnv() {
  // secret 키는 이 프로세스 메모리에만 둔다. 파일·로그·콘솔에 쓰지 않는다.
  const out = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const env = {};
  for (const line of out.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = localEnv();
if (!env.API_URL || !env.SECRET_KEY) {
  console.error('중단: supabase status에서 API_URL·SECRET_KEY를 읽지 못했다. 로컬 스택이 실행 중인지 확인한다.');
  process.exit(1);
}
if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) {
  console.error('중단: 로컬(127.0.0.1·localhost)이 아닌 API에는 시드 파일을 올리지 않는다.');
  process.exit(1);
}

const supabase = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });

const { data: wss, error: wsErr } = await supabase.from('workspaces').select('id').in('slug', SEED_SLUGS);
if (wsErr) {
  console.error(`중단: 시드 워크스페이스 조회 실패 ${wsErr.message}`);
  process.exit(1);
}

// 재실행 시 이전에 실패한 행도 다시 시도한다.
const { data: rows, error: fileErr } = await supabase
  .from('files')
  .select('id, name, object_name, mime, size_bytes, storage_path')
  .in('workspace_id', wss.map((w) => w.id))
  .in('status', ['pending', 'failed']);
if (fileErr) {
  console.error(`중단: files 조회 실패 ${fileErr.message}`);
  process.exit(1);
}
if (rows.length === 0) {
  console.log('올릴 files 행이 없다(pending·failed 0개).');
  process.exit(0);
}

let failed = 0;
for (const row of rows) {
  const buf = CONTENTS[row.object_name];
  let reason = null;
  if (!buf) {
    reason = '이 스크립트에 내용 정의가 없다';
  } else if (buf.length !== Number(row.size_bytes)) {
    reason = `크기 불일치(행 ${row.size_bytes}, 실제 ${buf.length})`;
  } else {
    const { error } = await supabase.storage
      .from('files')
      .upload(row.storage_path, buf, { contentType: row.mime, upsert: true });
    if (error) reason = `업로드 실패 ${error.message}`;
  }

  const { error: upErr } = await supabase
    .from('files')
    .update({ status: reason ? 'failed' : 'ready' })
    .eq('id', row.id);
  if (upErr) reason = `${reason ?? '업로드는 됐으나'} / 상태 갱신 실패 ${upErr.message}`;

  if (reason) {
    failed++;
    console.error(`실패 ${row.name}: ${reason}`);
  } else {
    console.log(`업로드 ${row.name} (${buf.length} B)`);
  }
}

console.log(`files ready ${rows.length - failed}/${rows.length}`);
if (failed > 0) process.exit(1);
