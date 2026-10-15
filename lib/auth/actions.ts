"use server";
// 인증·온보딩 Server Action. 입력을 검증한 뒤 서버 Supabase 클라이언트로 호출하고 한국어 오류를 돌려준다
import { redirect } from "next/navigation";
import { MSG, authErrorMessage, rpcErrorMessage } from "@/lib/auth/errors";
import {
  EMAIL_RE,
  MIN_PASSWORD_LENGTH,
  SLUG_RE,
  TEAM_SIZES,
  TEMPLATES,
  USAGES,
  isRecoverySession,
  type ActionState,
  type OnboardingInput,
} from "@/lib/auth/rules";
import { isDemoEnabled, isDemoUser } from "@/lib/demo/config";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// 비밀번호는 앞뒤 공백도 그대로 쓴다
function raw(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fail(field: string | undefined, message: string): ActionState {
  return { error: { field, message } };
}

function checkEmail(email: string) {
  if (!email) return fail("email", MSG.emailRequired);
  if (!EMAIL_RE.test(email)) return fail("email", MSG.emailInvalid);
  return null;
}

function checkPassword(password: string, field = "password") {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(field, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  return null;
}

// 이메일 링크의 돌아올 주소. Origin·Host 헤더는 위조할 수 있어 서버 환경변수 SITE_URL만 믿는다
// 값이 없으면 넘기지 않아 Supabase Auth의 site_url을 쓴다
function redirectTo(path: string) {
  const site = process.env.SITE_URL?.replace(/\/+$/, "");
  return site ? `${site}${path}` : undefined;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const password = raw(formData, "password");
  const invalid = checkEmail(email) ?? (password ? null : fail("password", MSG.passwordRequired));
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code) };
  redirect(safeNext(text(formData, "next")));
}

// 데모 시작. 익명 로그인 후 그 사용자 전용 데모 사본을 만들고 홈으로 보낸다.
// 이미 익명 사용자로 로그인했으면 새로 로그인하지 않아 같은 사본으로 간다
export async function signInDemo(): Promise<ActionState> {
  if (!isDemoEnabled()) return fail(undefined, MSG.demoDisabled);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!isDemoUser(data?.claims)) {
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { name: "데모 사용자" } } });
    if (error) {
      console.error("[데모 로그인]", error.code);
      return { error: authErrorMessage(error.code) };
    }
  }
  const { data: slug, error } = await supabase.rpc("start_demo_sandbox");
  if (error || !slug) {
    console.error("[데모 사본]", error?.code, error?.message);
    return fail(undefined, error?.message === "demo_full" ? MSG.demoFull : MSG.demoNotReady);
  }
  redirect(`/${slug}/home`);
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  const email = text(formData, "email");
  const password = raw(formData, "password");
  if (!name) return fail("name", MSG.nameRequired);
  if (name.length > 80) return fail("name", MSG.nameTooLong);
  const invalid = checkEmail(email) ?? checkPassword(password);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: redirectTo("/auth/confirm?next=/onboarding"),
    },
  });
  const exists = error?.code === "user_already_exists" || error?.code === "email_exists";
  // 메일 확인을 끈 설정(auth.email.enable_confirmations = false)에서는 가입 즉시 세션이 생겨 온보딩으로 간다.
  // 이때 기존 이메일은 오류로 오고, 확인 없이 로그인할 수 있어 계정 존재를 숨길 수 없으므로 로그인을 안내한다
  if (data.session) redirect("/onboarding");
  if (exists) return fail("email", MSG.emailTaken);
  if (error) return { error: authErrorMessage(error.code) };
  // 메일 확인을 켠 설정에서는 세션 없이 오므로 확인 메일 안내 화면으로 보낸다
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const invalid = checkEmail(email);
  if (invalid) return invalid;

  const supabase = await createClient();
  // 결과와 상관없이 같은 안내로 보낸다. 오류를 보이면 계정 존재 여부가 드러난다
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo("/auth/confirm?next=/reset"),
  });
  redirect("/forgot/sent");
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = raw(formData, "password");
  const confirm = raw(formData, "confirm");
  const invalid = checkPassword(password);
  if (invalid) return invalid;
  if (password !== confirm) return fail("confirm", MSG.passwordMismatch);

  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([supabase.auth.getClaims(), supabase.auth.getUser()]);
  // 로그인만으로는 바꿀 수 없다. 재설정 링크로 만든 세션이어야 한다
  if (!isRecoverySession(data?.claims, auth.user?.recovery_sent_at)) {
    return fail(undefined, MSG.recoveryExpired);
  }
  if (isDemoUser(auth.user)) return fail(undefined, MSG.demoRestricted);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.code) };
  redirect("/reset/done");
}

export async function resendConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const invalid = checkEmail(email);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo("/auth/confirm?next=/onboarding") },
  });
  // 보내기 제한만 알리고 그 밖의 오류는 계정 존재를 숨기려고 성공과 같게 둔다
  if (error?.code === "over_email_send_rate_limit") return { error: authErrorMessage(error.code) };
  return { ok: true };
}

const isOneOf = (list: readonly { id: string }[], value: string) => list.some((item) => item.id === value);

export async function completeOnboarding(input: OnboardingInput): Promise<ActionState> {
  const name = String(input?.name ?? "").trim();
  const slug = String(input?.slug ?? "").trim().toLowerCase();
  const projectName = String(input?.projectName ?? "").trim();
  const usage = String(input?.usage ?? "");
  const teamSize = String(input?.teamSize ?? "");
  const template = String(input?.template ?? "");
  const invites = (Array.isArray(input?.invites) ? input.invites : [])
    .map((e) => String(e).trim())
    .filter(Boolean);

  if (!isOneOf(USAGES, usage)) return fail("usage", MSG.usageRequired);
  if (!name) return fail("name", MSG.workspaceNameRequired);
  if (name.length > 80) return fail("name", MSG.workspaceNameTooLong);
  if (!SLUG_RE.test(slug)) return { error: rpcErrorMessage({ code: "P0001", message: "slug_invalid" }) };
  if (!isOneOf(TEAM_SIZES, teamSize)) return fail("teamSize", MSG.teamSizeRequired);
  if (!projectName) return fail("projectName", MSG.projectNameRequired);
  if (!isOneOf(TEMPLATES, template)) return fail("template", MSG.templateRequired);
  if (invites.length > 3) return fail("invites", MSG.tooManyInvites);
  const badInvite = invites.findIndex((e) => !EMAIL_RE.test(e));
  if (badInvite >= 0) return fail(`invite-${badInvite}`, MSG.emailInvalid);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return fail(undefined, MSG.sessionExpired);
  // 데모 사용자가 만든 워크스페이스는 사본 만료 정리로 지워지지 않아 만들지 못하게 한다
  if (isDemoUser(auth.claims)) return fail(undefined, MSG.demoRestricted);

  const { data, error } = await supabase.rpc("create_workspace_onboarding", {
    p_name: name,
    p_slug: slug,
    p_usage: usage,
    p_team_size: teamSize,
    p_project_name: projectName,
    p_template: template,
    p_invite_emails: invites,
  });
  if (error) return { error: rpcErrorMessage(error) };
  return { ok: true, slug: data?.[0]?.slug ?? slug };
}
