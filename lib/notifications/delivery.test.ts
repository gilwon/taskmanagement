// 이메일·푸시 발송 순수 로직 검증. 판정, 재시도 한도, 링크, 메일 본문, 인증 비교, 구독 검증
import { describe, expect, it } from "vitest";
import {
  MAX_DISPATCH_ATTEMPTS,
  buildMessage,
  isAuthorized,
  notificationPath,
  parsePushSubscription,
  pickLocale,
  planChannel,
  settle,
} from "@/lib/notifications/delivery";

const NOW = "2026-10-26T00:00:00.000Z";

describe("planChannel", () => {
  it("이미 보낸 채널은 done, 꺼진 채널은 skip, 켜진 채널은 send", () => {
    expect(planChannel(NOW, true)).toBe("done");
    expect(planChannel(null, false)).toBe("skip");
    expect(planChannel(null, true)).toBe("send");
  });
});

describe("settle", () => {
  it("보냈거나 skip이면 시각을 채우고 횟수는 그대로다", () => {
    expect(settle({ email: "send", push: "skip" }, { email: true, push: false }, 0, NOW)).toEqual({
      emailed_at: NOW,
      pushed_at: NOW,
    });
  });
  it("이미 보낸 채널은 건드리지 않는다", () => {
    expect(settle({ email: "done", push: "send" }, { email: false, push: true }, 0, NOW)).toEqual({ pushed_at: NOW });
  });
  it("실패하면 시각을 비우고 횟수만 올린다", () => {
    expect(settle({ email: "send", push: "skip" }, { email: false, push: false }, 1, NOW)).toEqual({
      pushed_at: NOW,
      dispatch_attempts: 2,
    });
  });
  it("한도에 닿으면 실패한 채널도 채워 재시도를 끝낸다", () => {
    const patch = settle({ email: "send", push: "send" }, { email: false, push: true }, MAX_DISPATCH_ATTEMPTS - 1, NOW);
    expect(patch).toEqual({ emailed_at: NOW, pushed_at: NOW, dispatch_attempts: MAX_DISPATCH_ATTEMPTS });
  });
});

describe("notificationPath", () => {
  it("작업, 프로젝트, 재고, 그 밖의 순서로 경로를 고른다", () => {
    expect(notificationPath("w", { type: "assign", taskKey: "A-1" })).toBe("/w/task/A-1");
    expect(notificationPath("w", { type: "assign", taskKey: "A-1", taskDeleted: true, projectKey: "A" })).toBe("/w/inbox");
    expect(notificationPath("w", { type: "comment", projectKey: "A" })).toBe("/w/projects/A/overview");
    expect(notificationPath("w", { type: "stock", stockItemId: "s1" })).toBe("/w/inventory?item=s1");
    expect(notificationPath("w", { type: "mention" })).toBe("/w/inbox");
  });
});

describe("buildMessage", () => {
  it("수신자 로캘의 종류 이름으로 제목을 만들고 링크를 붙인다", () => {
    const m = buildMessage("en", { type: "assign", text: "배정됨" }, "/w/task/A-1", "https://app.example/");
    expect(m.subject).toBe("[Assignments] 배정됨");
    expect(m.mailText).toBe("배정됨\n\nhttps://app.example/w/task/A-1\n");
    expect(m.url).toBe("https://app.example/w/task/A-1");
  });
  it("SITE_URL이 없으면 링크를 뺀다", () => {
    expect(buildMessage("ko", { type: "comment", text: "새 댓글" }, "/w/inbox", undefined).mailText).toBe("새 댓글\n");
  });
});

describe("pickLocale", () => {
  it("모르는 값은 ko다", () => {
    expect(pickLocale("ja")).toBe("ja");
    expect(pickLocale("fr")).toBe("ko");
    expect(pickLocale(null)).toBe("ko");
  });
});

describe("isAuthorized", () => {
  it("Bearer 값이 비밀과 같을 때만 통과한다", () => {
    expect(isAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorized("Bearer s3cret!", "s3cret")).toBe(false);
    expect(isAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isAuthorized(null, "s3cret")).toBe(false);
  });
});

describe("parsePushSubscription", () => {
  const ok = { endpoint: "https://push.example/x", keys: { p256dh: "k", auth: "a" } };
  it("https 주소와 두 키가 있으면 통과한다", () => {
    expect(parsePushSubscription(ok)).toEqual({ endpoint: ok.endpoint, p256dh: "k", auth: "a" });
  });
  it("http 주소, 키 누락, 너무 긴 값은 거부한다", () => {
    expect(parsePushSubscription({ ...ok, endpoint: "http://push.example/x" })).toBeNull();
    expect(parsePushSubscription({ endpoint: ok.endpoint, keys: { p256dh: "k" } })).toBeNull();
    expect(parsePushSubscription({ ...ok, endpoint: `https://${"a".repeat(2048)}` })).toBeNull();
    expect(parsePushSubscription(null)).toBeNull();
  });
});
