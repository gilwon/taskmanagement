// 이메일·푸시 사용 가능 여부와 공개 VAPID 키를 돌려준다. 그 밖의 비밀은 응답에 넣지 않는다
import { NextResponse } from "next/server";
import { getChannelConfig } from "@/lib/notifications/env";

export async function GET() {
  const { email, push } = getChannelConfig();
  return NextResponse.json(
    { email, push, vapidPublicKey: push ? (process.env.VAPID_PUBLIC_KEY ?? null) : null },
    { headers: { "cache-control": "no-store" } },
  );
}
