// 데모 설정 판정과 환경변수가 없을 때 데모 로그인 액션 거부를 검증한다
import { afterEach, describe, expect, it, vi } from "vitest";
import { MSG } from "@/lib/auth/errors";
import { demoCredentials, isDemoEnabled, isDemoUser } from "@/lib/demo/config";

const createClient = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

afterEach(() => {
  vi.unstubAllEnvs();
  createClient.mockReset();
});

describe("데모 설정", () => {
  it("이메일·비밀번호가 둘 다 있어야 켜진다", () => {
    vi.stubEnv("DEMO_EMAIL", "demo@example.test");
    vi.stubEnv("DEMO_PASSWORD", "");
    expect(isDemoEnabled()).toBe(false);
    vi.stubEnv("DEMO_PASSWORD", "x");
    expect(isDemoEnabled()).toBe(true);
    expect(demoCredentials()).toEqual({ email: "demo@example.test", password: "x" });
    vi.stubEnv("DEMO_EMAIL", " ");
    expect(isDemoEnabled()).toBe(false);
  });

  it("데모 계정은 대소문자와 앞뒤 공백을 무시하고 판정하고, 환경변수가 없으면 늘 거짓이다", () => {
    vi.stubEnv("DEMO_EMAIL", "Demo@Example.test");
    expect(isDemoUser(" demo@example.TEST ")).toBe(true);
    expect(isDemoUser("other@example.test")).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
    vi.stubEnv("DEMO_EMAIL", "");
    expect(isDemoUser("")).toBe(false);
    expect(isDemoUser("demo@example.test")).toBe(false);
  });

  it("환경변수가 없으면 데모 로그인 액션이 Supabase를 부르지 않고 거부한다", async () => {
    vi.stubEnv("DEMO_EMAIL", "");
    vi.stubEnv("DEMO_PASSWORD", "");
    const { signInDemo } = await import("@/lib/auth/actions");
    expect(await signInDemo()).toEqual({ error: { field: undefined, message: MSG.demoDisabled } });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("데모 계정 워크스페이스 이동 차단", () => {
  it("온보딩 완료와 초대 수락을 RPC 전에 거부한다", async () => {
    vi.stubEnv("DEMO_EMAIL", "demo@example.test");
    const rpc = vi.fn();
    createClient.mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: { sub: "u1", email: "demo@example.test" } } }) },
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
