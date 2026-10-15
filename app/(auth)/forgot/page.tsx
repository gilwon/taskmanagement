// 비밀번호 찾기 화면. 재설정 링크를 받을 이메일을 입력한다
import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function ForgotPage() {
  return <ForgotForm />;
}
