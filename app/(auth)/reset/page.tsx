// 새 비밀번호 설정 화면. 재설정 링크로 만든 세션(amr recovery, 10분 이내)일 때만 폼을 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";
import { isRecoverySession } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  // 일반 로그인 세션은 거부한다. /forgot로 보내면 로그인 사용자는 proxy가 /로 다시 보내 안내가 사라지므로 이 자리에서 알린다
  if (!isRecoverySession(data?.claims)) {
    return (
      <AuthCard
        title="링크가 만료되었습니다"
        description="비밀번호는 재설정 메일의 링크로 들어온 뒤 10분 안에만 바꿀 수 있습니다. 링크가 만료되었거나 이미 사용되었다면 비밀번호 찾기를 다시 요청해 주세요."
        footer={
          <Link href="/forgot" className={linkClass}>
            비밀번호 찾기
          </Link>
        }
      />
    );
  }
  return <ResetForm />;
}
