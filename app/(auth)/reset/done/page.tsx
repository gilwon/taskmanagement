// 비밀번호 변경 완료 안내 화면
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, buttonClass, primaryHover } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.resetDone.metaTitle") };
}

export default async function ResetDonePage() {
  const t = await getT();
  return (
    <AuthCard title={t("auth.resetDone.title")} description={t("auth.resetDone.description")}>
      <Button asChild className={`${buttonClass} ${primaryHover}`}>
        <Link href="/">{t("auth.resetDone.go")}</Link>
      </Button>
    </AuthCard>
  );
}
