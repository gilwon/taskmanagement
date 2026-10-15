#!/usr/bin/env bash
# 로컬 Supabase에 개발 시드(SQL 한 트랜잭션 + Storage 파일)를 넣는다. 원격 DB에는 실행하지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SEED_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# 원격 보호. URL을 파싱한 호스트가 정확히 127.0.0.1·localhost가 아니면 아무것도 하지 않는다.
# 문자열 패턴 검사는 쿼리·비밀번호 안의 '@localhost'에 속으므로 쓰지 않는다.
# 쿼리 문자열(?host=, ?hostaddr=, ?service= 등)은 libpq가 URL 호스트보다 우선하므로 붙어 있으면 거부한다.
if ! DB_URL="$DB_URL" node -e '
  let u;
  try { u = new URL(process.env.DB_URL); } catch { process.exit(1); }
  process.exit((u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.search === "" && u.hash === "" ? 0 : 1);
'; then
  echo "중단: 로컬(127.0.0.1·localhost)이 아닌 DB에는 시드를 넣지 않는다." >&2
  exit 1
fi

# libpq 환경 변수가 접속 대상을 바꾸지 못하게 지운다(PGHOSTADDR는 URL 호스트보다 우선한다).
unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE

existing="$(psql "$DB_URL" -Atc "select count(*) from public.workspaces where slug in ('company', 'dalbit', 'byeol')")"
if [ "$existing" != "0" ]; then
  echo "중단: 시드 워크스페이스(company·dalbit·byeol)가 이미 있다. pnpm db:reset 후 다시 실행한다." >&2
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -q -f supabase/seeds/dev.sql
echo "SQL 시드 완료. Storage 파일을 올린다."
node scripts/seed-files.mjs
