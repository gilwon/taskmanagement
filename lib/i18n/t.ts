// 사전 조회와 보간. 점 경로 키로 문구를 찾고 {이름} 자리를 값으로 바꾼다. 복수형 객체는 Intl.PluralRules로 고른다
import type { Locale } from "@/lib/i18n/locales";
import type { MessageAt, MessageKey, Messages, ParamNames, Plural } from "@/lib/i18n/messages/types";

export type Params = Record<string, string | number>;

// 자리 표시자가 있는 문구는 그 이름의 값을 모두 넘겨야 한다
type Args<K extends MessageKey> = [ParamNames<MessageAt<K>>] extends [never]
  ? [params?: Params]
  : [params: Record<ParamNames<MessageAt<K>>, string | number>];

export type T = <K extends MessageKey>(key: K, ...args: Args<K>) => string;

const isPlural = (value: unknown): value is Plural =>
  typeof value === "object" && value !== null && Object.hasOwn(value, "other");

export function createT(messages: Messages, locale: Locale): T {
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const t = (key: string, params?: Params) => {
    let value: unknown = messages;
    for (const part of key.split(".")) {
      value = typeof value === "object" && value !== null && Object.hasOwn(value, part) ? (value as Record<string, unknown>)[part] : undefined;
    }
    if (isPlural(value)) value = plural.select(Number(params?.count ?? 0)) === "one" ? value.one : value.other;
    // 없는 키는 키 이름을 그대로 보여 빠진 번역이 눈에 띄게 한다
    if (typeof value !== "string") return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, name: string) => {
      if (!Object.hasOwn(params, name)) return match;
      const v = params[name];
      return typeof v === "number" ? number.format(v) : v;
    });
  };
  return t as T;
}
