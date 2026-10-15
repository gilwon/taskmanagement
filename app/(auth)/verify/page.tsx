// 가입 후 메일 확인 안내 화면. 확인 메일을 다시 보낼 수 있다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { getT } from "@/lib/i18n/server";
import { ResendForm } from "./resend-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.verify.metaTitle") };
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  const t = await getT();
  // 주소만 굵게 보이려고 문장 틀을 {email} 앞뒤로 나눈다
  const [before, after] = t("auth.verify.sentTo", { email: "{email}" }).split("{email}");
  return (
    <AuthCard
      title={t("auth.verify.title")}
      description={
        address ? (
          <>
            {before}
            <strong className="font-medium break-all text-[var(--text)]">{address}</strong>
            {after}
          </>
        ) : (
          t("auth.verify.sentGeneric")
        )
      }
      footer={
        <Link href="/login" className={linkClass}>
          {t("auth.backToLogin")}
        </Link>
      }
    >
      <ResendForm email={address} />
    </AuthCard>
  );
}
