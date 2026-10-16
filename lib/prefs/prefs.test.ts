// 환경설정 저장값 검사와 head 인라인 스크립트가 같은 규칙으로 속성을 심는지 확인한다
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SCRIPT, motionOff, parsePrefs, resolveMotion } from "./prefs";

describe("parsePrefs", () => {
  it("빈 값·깨진 값은 기본값", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{oops")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("42")).toEqual(DEFAULT_PREFS);
  });

  it("허용 목록 밖의 값만 기본값으로 바꾼다", () => {
    const p = parsePrefs(JSON.stringify({ theme: "dark", accent: "neon", sidebarCollapsed: "yes" }));
    expect(p).toEqual({ ...DEFAULT_PREFS, theme: "dark" });
  });
});

describe("resolveMotion", () => {
  it("system은 OS 설정으로 확정한다", () => {
    expect(resolveMotion("system", true)).toBe("reduce");
    expect(resolveMotion("system", false)).toBe("full");
    expect(resolveMotion("reduce", false)).toBe("reduce");
  });
});

describe("motionOff", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("서버에서는 끄고, 브라우저에서는 data-motion=full이면서 OS 동작 줄이기가 아닐 때만 켠다", () => {
    expect(motionOff()).toBe(true);
    const html = { dataset: { motion: "full" } as DOMStringMap };
    let osReduce = false;
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { documentElement: html });
    vi.stubGlobal("matchMedia", () => ({ matches: osReduce }));
    expect(motionOff()).toBe(false);
    osReduce = true;
    expect(motionOff()).toBe(true);
    osReduce = false;
    html.dataset.motion = "reduce";
    expect(motionOff()).toBe(true);
  });
});

describe("PREFS_SCRIPT", () => {
  afterEach(() => vi.unstubAllGlobals());

  function run(stored: string | null, osReduce: boolean) {
    const attrs: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === PREFS_KEY ? stored : null) });
    vi.stubGlobal("matchMedia", () => ({ matches: osReduce }));
    vi.stubGlobal("document", {
      documentElement: {
        setAttribute: (k: string, v: string) => (attrs[k] = v),
        getAttribute: (k: string) => attrs[k] ?? null,
      },
    });
    new Function(PREFS_SCRIPT)();
    return attrs;
  }

  it("저장값을 심고 motion을 확정한다", () => {
    const attrs = run(JSON.stringify({ theme: "dark", accent: "teal", sidebarCollapsed: true }), true);
    expect(attrs).toEqual({
      "data-theme": "dark",
      "data-accent": "teal",
      "data-density": "comfortable",
      "data-side": "comfortable",
      "data-motion": "reduce",
      "data-sidebar": "collapsed",
    });
  });

  it("저장값이 없거나 깨져도 기본값을 심는다", () => {
    expect(run("{bad", false)["data-motion"]).toBe("full");
    expect(run(null, false)["data-accent"]).toBe("indigo");
  });
});
