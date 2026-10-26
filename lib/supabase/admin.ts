// service role Supabase 클라이언트. RLS를 우회하므로 알림 발송(dispatch)에서만 쓰고 서버 밖으로 내보내지 않는다
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("환경변수가 설정되지 않았습니다. SUPABASE_SERVICE_ROLE_KEY 값을 넣어 주세요.");
  return createClient<Database>(getSupabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
