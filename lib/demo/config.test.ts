// 데모 설정 판정, 데모 시작 액션(익명 로그인·사본 RPC), 데모 사용자 워크스페이스 이동 차단을 검증한다
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MSG } from "@/lib/auth/errors";
import { isDemoEnabled, isDemoUser } from "@/lib/demo/config";

const createClient = vi.fn();
vi.mock("server-only", () => ({}));
// 로캘은 쿠키·Accept-Language가 없어 기본값 ko로 정해진다
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

afterEach(() => {
  vi.unstubAllEnvs();
  createClient.mockReset();
});

describe("데모 설정", () => {
  it("DEMO_ENABLED가 정확히 true일 때만 켜진다", () => {
    vi.stubEnv("DEMO_ENABLED", "");
    expect(isDemoEnabled()).toBe(false);
    vi.stubEnv("DEMO_ENABLED", "1");
    expect(isDemoEnabled()).toBe(false);
    vi.stubEnv("DEMO_ENABLED", "true");
    expect(isDemoEnabled()).toBe(true);
  });

  it("익명 로그인 사용자만 데모 사용자다", () => {
    expect(isDemoUser({ is_anonymous: true })).toBe(true);
    expect(isDemoUser({ is_anonymous: false })).toBe(false);
    expect(isDemoUser({})).toBe(false);
    expect(isDemoUser(null)).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
  });

  it("꺼져 있으면 데모 시작 액션이 Supabase를 부르지 않고 거부한다", async () => {
    vi.stubEnv("DEMO_ENABLED", "");
    const { signInDemo } = await import("@/lib/auth/actions");
    expect(await signInDemo()).toEqual({ error: { field: undefined, message: MSG.demoDisabled } });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("데모 시작", () => {
  it("익명 로그인 후 사본 slug의 홈으로 보낸다", async () => {
    vi.stubEnv("DEMO_ENABLED", "true");
    const signInAnonymously = vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null }));
    const rpc = vi.fn(async () => ({ data: "demo-abc12345", error: null }));
    const from = () => ({ update: () => ({ eq: async () => ({ error: null }) }) });
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: null }), signInAnonymously }, rpc, from });
    const { signInDemo } = await import("@/lib/auth/actions");
    await signInDemo();
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { data: { name: "데모 사용자" } } });
    expect(rpc).toHaveBeenCalledWith("start_demo_sandbox");
    expect(redirect).toHaveBeenCalledWith("/demo-abc12345/home");
  });

  it("이미 익명 사용자면 다시 로그인하지 않고, 상한이면 demoFull 문구를 돌려준다", async () => {
    vi.stubEnv("DEMO_ENABLED", "true");
    const signInAnonymously = vi.fn();
    const rpc = vi.fn(async () => ({ data: null, error: { code: "P0001", message: "demo_full" } }));
    createClient.mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: { sub: "u1", is_anonymous: true } } }), signInAnonymously },
      rpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { locale: "ko" } }) }) }) }),
    });
    const { signInDemo } = await import("@/lib/auth/actions");
    expect(await signInDemo()).toEqual({ error: { field: undefined, message: MSG.demoFull } });
    expect(signInAnonymously).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "forbidden" } });
    expect(await signInDemo()).toEqual({ error: { field: undefined, message: MSG.demoNotReady } });
  });
});

describe("데모 사용자 워크스페이스 이동 차단", () => {
  it("온보딩 완료와 초대 수락을 RPC 전에 거부한다", async () => {
    const rpc = vi.fn();
    createClient.mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: { sub: "u1", is_anonymous: true } } }) },
      rpc,
    });
    const { completeOnboarding } = await import("@/lib/auth/actions");
    const { acceptInvite } = await import("@/lib/org/actions");
    const input = { usage: "work", name: "새 공간", slug: "new-space", teamSize: "solo", projectName: "첫 프로젝트", template: "blank", invites: [] };
    expect(await completeOnboarding(input)).toEqual({ error: { field: undefined, message: MSG.demoRestricted } });
    expect(await acceptInvite("00000000-0000-4000-8000-000000000001")).toEqual({ ok: false, error: MSG.demoRestricted });
    expect(rpc).not.toHaveBeenCalled();
  });
});
