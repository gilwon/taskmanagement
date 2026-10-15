// 로캘 판정·Accept-Language 매칭, t 보간·복수형·없는 키, 영어 날짜 포매터를 검증한다
import { describe, expect, it } from "vitest";
import { createFormatter } from "@/lib/i18n/format";
import { isLocale, matchAcceptLanguage } from "@/lib/i18n/locales";
import en from "@/lib/i18n/messages/en";
import ko from "@/lib/i18n/messages/ko";
import type { Messages } from "@/lib/i18n/messages/types";
import { createT } from "@/lib/i18n/t";

describe("matchAcceptLanguage", () => {
  it("q값 순으로 고를 수 있는 로캘을 찾고, 지역 태그는 언어로 맞춘다", () => {
    expect(matchAcceptLanguage("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("fr-FR,ko;q=0.5,en;q=0.7")).toBe("en");
    expect(matchAcceptLanguage("ko-KR")).toBe("ko");
  });

  it("맞는 것이 없거나 비면 ko다", () => {
    expect(matchAcceptLanguage("fr,de;q=0.8")).toBe("ko");
    expect(matchAcceptLanguage("")).toBe("ko");
    expect(matchAcceptLanguage(null)).toBe("ko");
    expect(matchAcceptLanguage("en;q=0")).toBe("ko");
  });

  it("사전이 없는 ja·zh-CN은 고르지 않지만, 있으면 간체만 zh-CN으로 맞춘다", () => {
    expect(matchAcceptLanguage("ja,en;q=0.5")).toBe("en");
    const all = ["ko", "en", "ja", "zh-CN"] as const;
    expect(matchAcceptLanguage("zh-Hans-CN", all)).toBe("zh-CN");
    expect(matchAcceptLanguage("zh", all)).toBe("zh-CN");
    expect(matchAcceptLanguage("zh-TW,en;q=0.5", all)).toBe("en");
  });

  it("isLocale은 목록 값만 받는다", () => {
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("zh-TW")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("createT", () => {
  const ko_ = createT(ko, "ko");
  const en_ = createT(en, "en");

  it("점 경로로 찾고 {이름}을 바꾼다. 숫자는 로캘 형식이다", () => {
    expect(ko_("common.taskStatus.todo")).toBe("할 일");
    expect(en_("common.generalAccess.workspace", { ws: "Acme" })).toBe("Everyone in Acme");
    expect(en_("common.homeStatNote.risk", { n: 1200 })).toBe("1,200 at risk");
  });

  it("복수형은 PluralRules 범주로 고른다", () => {
    const msgs = { org: { n: { one: "{count} team", other: "{count} teams" } } } as unknown as Messages;
    const t = createT(msgs, "en") as unknown as (k: string, p: Record<string, number>) => string;
    expect(t("org.n", { count: 1 })).toBe("1 team");
    expect(t("org.n", { count: 2 })).toBe("2 teams");
  });

  it("없는 키는 키 이름을 그대로 돌려준다", () => {
    const t = ko_ as unknown as (k: string) => string;
    expect(t("common.nope")).toBe("common.nope");
    expect(t("common.__proto__")).toBe("common.__proto__");
  });
});

describe("createFormatter(en)", () => {
  const f = createFormatter("en");
  // 2026-10-15(목) 12:00 KST
  const NOON = new Date("2026-10-15T03:00:00Z");

  it("기한은 Today·요일·날짜 순이다", () => {
    expect(f.due("2026-10-15", NOON)).toBe("Today");
    expect(f.due("2026-10-16", NOON)).toBe("Tomorrow");
    expect(f.due("2026-10-17", NOON)).toBe("Sat");
    expect(f.due("2026-10-22", NOON)).toBe("Oct 22");
    expect(f.due("2027-01-10", NOON)).toBe("Jan 10, 2027");
  });

  it("상대 시간과 월 제목", () => {
    expect(f.relative(new Date(NOON.getTime() - 30_000), NOON)).toBe("Just now");
    expect(f.relative(new Date(NOON.getTime() - 2 * 86_400_000), NOON)).toBe("2 days ago");
    expect(f.monthTitle(NOON)).toBe("October 2026");
  });
});
