// 알림 이메일·푸시 발송 진입점. Vercel 크론(GET)과 수동 호출(POST)이 같은 Bearer CRON_SECRET 인증을 쓴다
import { NextResponse } from "next/server";
import { runDispatch } from "@/lib/notifications/dispatch";
import { isAuthorized } from "@/lib/notifications/delivery";

export const maxDuration = 60;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDispatch(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // 키·주소가 섞일 수 있어 메시지는 로그에만 남기고 응답에는 넣지 않는다
    console.error("[dispatch]", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
