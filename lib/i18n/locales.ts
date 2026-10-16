// 지원 로캘 목록·기본값·판정과 Accept-Language 매칭. 서버·클라이언트가 함께 쓴다
export const LOCALES = ["ko", "en", "ja", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

// 사전이 있어 고를 수 있는 로캘. 새 언어는 사전을 만든 뒤 여기와 server.ts MESSAGES에 더한다
export const SELECTABLE_LOCALES = ["ko", "en", "ja", "zh-CN"] as const satisfies readonly Locale[];
export type SelectableLocale = (typeof SELECTABLE_LOCALES)[number];

export const LOCALE_COOKIE = "locale";
// 쿠키 보관 기간 1년(초)
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isSelectableLocale(value: unknown): value is SelectableLocale {
  return typeof value === "string" && (SELECTABLE_LOCALES as readonly string[]).includes(value);
}

// Accept-Language에서 고를 수 있는 로캘을 q값 순으로 찾는다. 정확히 같은 태그가 먼저이고, 그다음 언어 부분(en-US → en)이 같은 것.
// zh-TW·zh-Hant처럼 번체는 zh-CN으로 맞추지 않는다. 맞는 것이 없으면 기본값
export function matchAcceptLanguage(
  header: string | null | undefined,
  available: readonly Locale[] = SELECTABLE_LOCALES,
): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((w) => w.tag && w.tag !== "*" && Number.isFinite(w.q) && w.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of wanted) {
    const exact = available.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    const [lang, ...rest] = tag.split("-");
    if (lang === "zh") {
      // 간체만 지원한다. 지역·문자 표기가 없거나 간체 지역이면 zh-CN
      const simplified = rest.length === 0 || rest.some((r) => r === "cn" || r === "sg" || r === "hans");
      if (simplified && available.includes("zh-CN")) return "zh-CN";
      continue;
    }
    const loose = available.find((l) => l.toLowerCase().split("-")[0] === lang);
    if (loose) return loose;
  }
  return DEFAULT_LOCALE;
}
