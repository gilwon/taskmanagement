#!/usr/bin/env bash
# 로컬 Supabase에 데모 워크스페이스(slug demo)를 넣거나 처음 상태로 되돌린다. 원격 DB에는 실행하지 않는다.
# 데모 계정 자격은 셸 환경변수 DEMO_EMAIL·DEMO_PASSWORD, 없으면 .env.local에서 읽는다. 값은 출력하지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SEED_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# 원격 보호. db-seed.sh와 같은 규칙이다.
if ! DB_URL="$DB_URL" node -e '
  let u;
  try { u = new URL(process.env.DB_URL); } catch { process.exit(1); }
  process.exit((u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.search === "" && u.hash === "" ? 0 : 1);
'; then
  echo "중단: 로컬(127.0.0.1·localhost)이 아닌 DB에는 데모 시드를 넣지 않는다." >&2
  exit 1
fi

unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE

# .env.local은 source하지 않고 해당 줄만 읽는다(파일 안 다른 줄이 셸로 실행되지 않게).
# 이 읽기와 Next(dotenv)가 같은 값을 얻도록, 해석이 달라질 수 있는 값은 아래에서 거부한다.
env_local() {
  [ -f .env.local ] && sed -n "s/^$1=//p" .env.local | tail -n 1
}
export DEMO_EMAIL="${DEMO_EMAIL:-$(env_local DEMO_EMAIL)}"
export DEMO_PASSWORD="${DEMO_PASSWORD:-$(env_local DEMO_PASSWORD)}"
if [ -z "$DEMO_EMAIL" ] || [ -z "$DEMO_PASSWORD" ]; then
  echo "중단: DEMO_EMAIL·DEMO_PASSWORD가 없다. .env.local에 넣는다(.env.example 참고)." >&2
  exit 1
fi
# 따옴표·#·$·CR·앞뒤 공백은 dotenv가 다르게 해석해 앱과 시드의 비밀번호가 어긋날 수 있다. 값은 출력하지 않는다.
check_value() {
  if [[ "$2" == *[\"\'#\$]* || "$2" == *$'\r'* || "$2" =~ ^[[:space:]] || "$2" =~ [[:space:]]$ ]]; then
    echo "중단: $1 값에 따옴표·#·\$·줄바꿈(CR)·앞뒤 공백이 있다. 영문·숫자 같은 단순한 값으로 바꾼다." >&2
    exit 1
  fi
}
check_value DEMO_EMAIL "$DEMO_EMAIL"
check_value DEMO_PASSWORD "$DEMO_PASSWORD"

# 지울 데모 워크스페이스(demo_seed 계정만 구성원인 곳, slug 무관)의 Storage 객체를 SQL 전에 먼저 지운다.
# storage.objects는 SQL로 지울 수 없고, 행을 먼저 지우면 객체 삭제가 실패할 때 고아가 남는다.
# demo.sql이 객체가 남아 있으면 멈추므로 여기서 실패해도 행은 그대로다.
objects="$(psql "$DB_URL" -Atc "
  select o.name from storage.objects o
  join public.workspaces w on o.name like w.id::text || '/%'
  where o.bucket_id = 'files'
    and exists (select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
                where m.workspace_id = w.id and u.raw_app_meta_data ->> 'demo_seed' = 'true')
    and not exists (select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
                    where m.workspace_id = w.id and coalesce(u.raw_app_meta_data ->> 'demo_seed', '') <> 'true')")"

if [ -z "$objects" ]; then
  echo "지울 데모 Storage 객체가 없다."
else
  # seed-files.mjs와 같이 secret 키는 이 프로세스 메모리에만 둔다.
  printf '%s\n' "$objects" | node --input-type=module -e '
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const out = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const env = {};
for (const line of out.split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
}
if (!env.API_URL || !env.SECRET_KEY || !["127.0.0.1", "localhost"].includes(new URL(env.API_URL).hostname)) {
  console.error("중단: 로컬 Storage API 주소·키를 읽지 못했다. 데모 데이터는 바꾸지 않았다.");
  process.exit(1);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const names = input.split("\n").filter(Boolean);
const supabase = createClient(env.API_URL, env.SECRET_KEY, { auth: { persistSession: false } });
for (let i = 0; i < names.length; i += 100) {
  const { error } = await supabase.storage.from("files").remove(names.slice(i, i + 100));
  if (error) {
    console.error(`중단: Storage 객체 삭제 실패 ${error.message}. 데모 데이터는 바꾸지 않았다.`);
    process.exit(1);
  }
}
console.log(`데모 Storage 객체 ${names.length}개를 지웠다.`);
'
fi

# psql이 \getenv로 자격을 읽는다. 명령행 인자로 넘기지 않아 프로세스 목록에 남지 않는다.
psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -q -f supabase/seeds/demo.sql
echo "데모 SQL 완료."
