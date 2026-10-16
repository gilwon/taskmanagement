// 재설정 메일 요청 후 안내 화면. 계정 존재 여부와 상관없이 같은 문구를 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { Envelope } from "@/components/auth/envelope";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.forgotSent.metaTitle") };
}

export default async function ForgotSentPage() {
  const t = await getT();
  return (
    <AuthCard
      art={<Envelope />}
      title={t("auth.forgotSent.title")}
      description={t("auth.forgotSent.description")}
      footer={
        <>
          <Link href="/forgot" className={linkClass}>
            {t("auth.forgotSent.again")}
          </Link>
          <span aria-hidden> · </span>
          <Link href="/login" className={linkClass}>
            {t("auth.backToLogin")}
          </Link>
        </>
      }
    />
  );
}
