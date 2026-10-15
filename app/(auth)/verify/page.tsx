// 가입 후 메일 확인 안내 화면. 확인 메일을 다시 보낼 수 있다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "메일 확인" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  return (
    <AuthCard
      title="메일함을 확인해 주세요"
      description={
        address ? (
          <>
            <strong className="font-medium break-all text-[var(--text)]">{address}</strong>(으)로 확인 링크를 보냈습니다.
            링크를 누르면 가입이 완료됩니다.
          </>
        ) : (
          "가입한 이메일로 확인 링크를 보냈습니다. 링크를 누르면 가입이 완료됩니다."
        )
      }
      footer={
        <Link href="/login" className={linkClass}>
          로그인으로 돌아가기
        </Link>
      }
    >
      <ResendForm email={address} />
    </AuthCard>
  );
}
