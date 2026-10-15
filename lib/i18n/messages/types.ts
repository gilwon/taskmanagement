// 사전 타입. 한국어 사전(ko)의 모양이 기준이고, 다른 언어 사전은 같은 키에 문자열 값을 가져야 한다
import type ko from "./ko";

// 복수형 문구. Intl.PluralRules 범주별 문장이고 other는 반드시 있다. 한국어는 other만 쓰지만 키를 맞추려고 one도 둔다
export type Plural = { readonly one: string; readonly other: string };

// 리터럴 문자열을 string으로 넓힌다. 키 구성은 그대로 두어 누락·초과 키가 typecheck에서 걸린다
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof ko>;
export type Ko = typeof ko;

// 점 경로 키. 문자열과 복수형 객체가 끝 값이다
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Ko>;

// 키가 가리키는 한국어 값의 타입
export type MessageAt<K extends string, T = Ko> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? MessageAt<R, T[H]>
    : never
  : K extends keyof T
    ? T[K]
    : never;

// 문구 안 {이름} 자리 표시자 이름을 뽑는다. 넓혀진 string이면 알 수 없으므로 never
type Names<S> = string extends S ? never : S extends `${string}{${infer P}}${infer R}` ? P | Names<R> : never;
export type ParamNames<V> = V extends Plural ? Names<V["one"]> | Names<V["other"]> | "count" : Names<V>;
