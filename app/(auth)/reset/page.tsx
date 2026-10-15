// 새 비밀번호 설정 화면. 재설정 링크로 만든 세션(amr recovery, 10분 이내)일 때만 폼을 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { isRecoverySession } from "@/lib/auth/rules";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.reset.metaTitle") };
}

export default async function ResetPage() {
  const supabase = await createClient();
  const t = await getT();
  const [{ data }, { data: auth }] = await Promise.all([supabase.auth.getClaims(), supabase.auth.getUser()]);
  // 일반 로그인 세션은 거부한다. /forgot로 보내면 로그인 사용자는 proxy가 /로 다시 보내 안내가 사라지므로 이 자리에서 알린다
  if (!isRecoverySession(data?.claims, auth.user?.recovery_sent_at)) {
    return (
      <AuthCard
        title={t("auth.reset.expiredTitle")}
        description={t("auth.reset.expiredDescription")}
        footer={
          <Link href="/forgot" className={linkClass}>
            {t("auth.reset.forgot")}
          </Link>
        }
      />
    );
  }
  return <ResetForm />;
}
