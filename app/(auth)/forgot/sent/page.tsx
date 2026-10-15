// 재설정 메일 요청 후 안내 화면. 계정 존재 여부와 상관없이 같은 문구를 보인다
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, linkClass } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "메일 발송" };

export default function ForgotSentPage() {
  return (
    <AuthCard
      title="메일함을 확인해 주세요"
      description="입력한 이메일로 가입된 계정이 있으면 비밀번호 재설정 링크를 보냈습니다. 링크는 요청한 브라우저에서 열어 주세요."
      footer={
        <>
          <Link href="/forgot" className={linkClass}>
            다시 요청하기
          </Link>
          <span aria-hidden> · </span>
          <Link href="/login" className={linkClass}>
            로그인으로 돌아가기
          </Link>
        </>
      }
    />
  );
}
