// 비밀번호 변경 완료 안내 화면
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, buttonClass, primaryHover } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "비밀번호 변경 완료" };

export default function ResetDonePage() {
  return (
    <AuthCard title="비밀번호를 바꿨습니다" description="새 비밀번호로 계속 이용할 수 있습니다.">
      <Button asChild className={`${buttonClass} ${primaryHover}`}>
        <Link href="/">작업 공간으로 이동</Link>
      </Button>
    </AuthCard>
  );
}
