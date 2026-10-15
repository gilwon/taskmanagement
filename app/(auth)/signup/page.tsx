// 가입 화면
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.signup.metaTitle") };
}

export default function SignupPage() {
  return <SignupForm />;
}
