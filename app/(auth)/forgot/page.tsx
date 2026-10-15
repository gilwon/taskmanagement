// 비밀번호 찾기 화면. 재설정 링크를 받을 이메일을 입력한다
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.forgot.title") };
}

export default function ForgotPage() {
  return <ForgotForm />;
}
