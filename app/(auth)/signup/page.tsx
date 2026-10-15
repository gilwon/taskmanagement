// 가입 화면
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "가입" };

export default function SignupPage() {
  return <SignupForm />;
}
