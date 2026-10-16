// 로컬 UI 환경설정의 값 목록·기본값·저장·html 속성 반영. 업무 데이터와 토큰은 다루지 않는다
export const PREF_OPTIONS = {
  theme: ["light", "dark", "system"],
  accent: ["indigo", "blue", "violet", "teal", "rose", "graphite"],
  density: ["comfortable", "compact"],
  side: ["comfortable", "compact"],
  motion: ["full", "reduce", "system"],
} as const;

type Options = typeof PREF_OPTIONS;
export type Prefs = { [K in keyof Options]: Options[K][number] } & { sidebarCollapsed: boolean };

// META §5 prefs 기본값
export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  accent: "indigo",
  density: "comfortable",
  side: "comfortable",
  motion: "system",
  sidebarCollapsed: false,
};

export const PREFS_KEY = "tm-prefs";

// 저장값을 검사해 허용 목록 밖의 값은 기본값으로 바꾼다
export function parsePrefs(raw: string | null): Prefs {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // 깨진 값은 무시하고 기본값으로 간다
  }
  const pick = <K extends keyof Options>(key: K): Prefs[K] => {
    const v = data[key];
    return (PREF_OPTIONS[key] as readonly unknown[]).includes(v) ? (v as Prefs[K]) : DEFAULT_PREFS[key];
  };
  return {
    theme: pick("theme"),
    accent: pick("accent"),
    density: pick("density"),
    side: pick("side"),
    motion: pick("motion"),
    sidebarCollapsed: data.sidebarCollapsed === true,
  };
}

export function readPrefs(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 저장소가 막혀 있어도 현재 화면에는 반영된다
  }
}

// motion=system은 OS의 동작 줄이기 설정으로 full/reduce를 확정한다(META §8)
export function resolveMotion(motion: Prefs["motion"], osReduce: boolean) {
  if (motion === "system") return osReduce ? "reduce" : "full";
  return motion;
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// JS 애니메이션 공용 판정. 앱 모션이 full이 아니거나 OS가 동작 줄이기면 끄고, 서버 렌더에서는 끈 쪽으로 둔다
export function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion !== "full" || matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function applyPrefs(prefs: Prefs) {
  const el = document.documentElement;
  el.dataset.theme = prefs.theme;
  el.dataset.accent = prefs.accent;
  el.dataset.density = prefs.density;
  el.dataset.side = prefs.side;
  el.dataset.motion = resolveMotion(prefs.motion, matchMedia(REDUCED_MOTION_QUERY).matches);
  el.dataset.sidebar = prefs.sidebarCollapsed ? "collapsed" : "expanded";
}

// 첫 화면 깜빡임을 막는 head 인라인 스크립트. 위 parsePrefs·applyPrefs와 같은 규칙을 ES5로 줄여 쓴다
export const PREFS_SCRIPT = `(function(){try{var o=${JSON.stringify(PREF_OPTIONS)},d=${JSON.stringify(
  DEFAULT_PREFS,
)},p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)}))||{}}catch(e){}var e=document.documentElement;for(var k in o){e.setAttribute("data-"+k,o[k].indexOf(p[k])>-1?p[k]:d[k])}var m=e.getAttribute("data-motion");if(m==="system")e.setAttribute("data-motion",matchMedia(${JSON.stringify(
  REDUCED_MOTION_QUERY,
)}).matches?"reduce":"full");e.setAttribute("data-sidebar",p.sidebarCollapsed===true?"collapsed":"expanded")}catch(e){}})()`;
