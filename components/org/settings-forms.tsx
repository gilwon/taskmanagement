"use client";
// 설정 화면의 입력 폼. 워크스페이스 일반·위험 구역, 화면 설정, 알림, 프로필, 시간대, 비밀번호, 로그인 세션
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, MessageSquare, Package, RefreshCw, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { SettingsCard } from "@/components/org/settings-parts";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { signOut } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH, SLUG_RE } from "@/lib/auth/rules";
import { useLocale, useT } from "@/lib/i18n/client";
import {
  changePassword,
  deleteWorkspace,
  saveNotifPrefs,
  signOutOthers,
  updateProfile,
  updateTimezone,
  updateWorkspace,
  type PasswordState,
} from "@/lib/org/actions";
import type { NotifPrefs } from "@/lib/org/queries";
import { NOTIF_KEYS } from "@/lib/org/rules";
import { PREF_OPTIONS, type Prefs } from "@/lib/prefs/prefs";
import { motionOff } from "@/lib/prefs/prefs";
import { usePrefs } from "@/lib/prefs/provider";
import "./lucian-settings.css";

function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-(length:--fs-sm) text-(--red)">
      {message}
    </p>
  );
}

function saved(msg: string) {
  toast.success(msg);
  announce(msg);
}

// ─────────────────────────────────────────────
// 일반. 워크스페이스 이름·URL. 관리자만 고칠 수 있다
// ─────────────────────────────────────────────
export function GeneralForm({
  workspace,
  canEdit,
}: {
  workspace: { id: string; slug: string; name: string };
  canEdit: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<{ field: "name" | "slug" | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== workspace.name || slug.trim() !== workspace.slug;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    if (!name.trim()) return setError({ field: "name", message: t("errors.msg.workspaceNameRequired") });
    if (!SLUG_RE.test(slug.trim().toLowerCase())) return setError({ field: "slug", message: t("errors.msg.slugInvalid") });
    setBusy(true);
    const r = await updateWorkspace(workspace.id, { name, slug });
    setBusy(false);
    if (!r.ok) {
      return setError({ field: r.field ?? null, message: r.error });
    }
    saved(t("org.settings.general.saved"));
    if (r.data.slug !== workspace.slug) router.replace(`/${r.data.slug}/settings/general`);
  };

  return (
    <SettingsCard
      id="ws-general"
      title={t("org.settings.section.general")}
      description={canEdit ? undefined : t("org.settings.general.adminOnly")}
    >
      <form onSubmit={submit} method="post" className="grid gap-(--s-4)">
        <div className="grid gap-1.5">
          <Label htmlFor="ws-name">{t("org.settings.general.name")}</Label>
          <Input
            id="ws-name"
            value={name}
            maxLength={80}
            disabled={!canEdit}
            aria-invalid={error?.field === "name" || undefined}
            aria-describedby={error?.field === "name" ? "ws-error" : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ws-slug">{t("org.settings.general.url")}</Label>
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-(length:--fs-sm) text-(--text-3)">/</span>
            <Input
              id="ws-slug"
              value={slug}
              maxLength={39}
              disabled={!canEdit}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={error?.field === "slug" || undefined}
              aria-describedby={`ws-slug-hint${error?.field === "slug" ? " ws-error" : ""}`}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setError(null);
              }}
            />
          </div>
          <p id="ws-slug-hint" className="text-(length:--fs-xs) text-(--text-3)">
            {t("org.settings.general.urlHint")}
          </p>
        </div>
        <FieldError id="ws-error" message={error?.message} />
        {canEdit && (
          <div>
            <Button type="submit" disabled={busy || !dirty} aria-busy={busy}>
              {t("common.action.save")}
            </Button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}

// 위험 구역. 소유자에게만 보인다. URL을 그대로 입력해야 지운다
export function DangerZone({ workspace }: { workspace: { id: string; slug: string; name: string } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <SettingsCard
      id="ws-danger"
      tone="danger"
      title={t("org.settings.danger.title")}
      description={t("org.settings.danger.description")}
    >
      <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          {t("org.settings.danger.delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("org.settings.danger.delete")}
        description={t("org.settings.danger.confirmDescription", { name: workspace.name })}
        confirmLabel={t("org.settings.danger.confirmLabel")}
        requireText={workspace.slug}
        onConfirm={async (typed) => {
          // 성공하면 서버가 /로 보낸다
          const r = await deleteWorkspace(workspace.id, typed);
          return r.ok ? null : r.error;
        }}
      />
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────
// 화면 설정. 기존 환경설정 provider를 그대로 써서 즉시 반영한다(localStorage)
// ─────────────────────────────────────────────
// 표시명은 사전 org.settings.appearance.<키>와 common.pref.<키>.<값>에 있다
const PREF_ROWS: (keyof typeof PREF_OPTIONS)[] = ["theme", "accent", "density", "side", "motion"];

export function AppearanceForm() {
  const t = useT();
  const { prefs, setPref } = usePrefs();
  return (
    <SettingsCard id="appearance" title={t("org.settings.section.appearance")} description={t("org.settings.appearance.description")}>
      {PREF_ROWS.map((key) => {
        const label = t(`org.settings.appearance.${key}`);
        return (
          <div key={key} className="grid gap-1.5">
            <span id={`pref-${key}`} className="text-(length:--fs-sm) font-medium text-(--text-2)">
              {label}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={prefs[key]}
              aria-labelledby={`pref-${key}`}
              onValueChange={(v) => v && setPref(key, v as Prefs[typeof key])}
              className="flex-wrap"
            >
              {PREF_OPTIONS[key].map((v) => (
                <ToggleGroupItem
                  key={v}
                  value={v}
                  className="px-3 data-[state=on]:bg-(--accent-soft) data-[state=on]:font-medium data-[state=on]:text-(--accent-ink)"
                >
                  {/* key·v 조합은 PREF_OPTIONS가 보장한다. 타입은 조합을 좁히지 못해 한 키로 단언한다 */}
                  {t(`common.pref.${key}.${v}` as "common.pref.theme.light")}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        );
      })}
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────
// 알림. 앱 내 알림은 종류별로 끄고 켠다
// ─────────────────────────────────────────────

// Lucian UX/UI Prompt #023 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#023
// 종류별 아이콘과 배경 그라디언트 색(프로젝트 토큰)
const NOTIF_ICON = {
  mention: { Icon: AtSign, from: "var(--accent)", to: "var(--blue)" },
  assign: { Icon: UserCheck, from: "var(--blue)", to: "var(--teal)" },
  update: { Icon: RefreshCw, from: "var(--accent)", to: "var(--amber)" },
  comment: { Icon: MessageSquare, from: "var(--green)", to: "var(--teal)" },
  stock: { Icon: Package, from: "var(--amber)", to: "var(--red)" },
} as const;

export function NotificationsForm({ workspaceId, initial }: { workspaceId: string; initial: NotifPrefs }) {
  const t = useT();
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  // 모두 끄기가 항목마다 이어서 저장하므로 최신 값은 ref로 읽는다
  const prefsRef = useRef(prefs);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const toggle = async (key: keyof NotifPrefs, value: boolean) => {
    const prev = prefsRef.current;
    const next = { ...prev, [key]: value };
    prefsRef.current = next;
    setPrefs(next);
    setBusy(true);
    const r = await saveNotifPrefs(workspaceId, next);
    if (mounted.current) setBusy(false);
    if (!r.ok) {
      prefsRef.current = prev;
      if (mounted.current) setPrefs(prev);
      toast.error(r.error);
      return false;
    }
    const type = t(`common.notificationType.${key}`);
    saved(value ? t("org.settings.notifications.turnedOn", { type }) : t("org.settings.notifications.turnedOff", { type }));
    return true;
  };

  // 켜진 종류를 위에서부터 0.12초 간격으로 하나씩 끈다(#023). 저장은 항목마다 기존 호출을 쓰고, 실패하면 거기서 멈춘다
  const turnOffAll = async () => {
    for (const k of NOTIF_KEYS) {
      if (!mounted.current) return;
      if (!prefsRef.current[k]) continue;
      if (!(await toggle(k, false))) return;
      if (!motionOff()) await new Promise((res) => setTimeout(res, 120));
    }
  };

  return (
    <>
      <SettingsCard
        id="notif-app"
        title={t("org.settings.notifications.appTitle")}
        description={t("org.settings.notifications.appDescription")}
      >
        <div className="ux u023">
          {NOTIF_KEYS.map((k) => {
            const { Icon, from, to } = NOTIF_ICON[k];
            return (
              <div key={k} className={cn("u023-item", !prefs[k] && "is-off")}>
                <div className="u023-head">
                  <span className="u023-ic" style={{ "--g": `linear-gradient(140deg, ${from}, ${to})` } as React.CSSProperties} aria-hidden="true">
                    <Icon />
                  </span>
                  <Label htmlFor={`notif-${k}`} className="u023-t grid gap-0.5 font-normal">
                    <span className="text-(length:--fs-base) text-(--text)">{t(`common.notificationType.${k}`)}</span>
                    <span className="text-(length:--fs-xs) text-(--text-3)">{t(`common.notifPrefDescription.${k}`)}</span>
                  </Label>
                  <Switch id={`notif-${k}`} checked={prefs[k]} disabled={busy} onCheckedChange={(v) => toggle(k, v)} />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="u023-all"
            disabled={busy || NOTIF_KEYS.every((k) => !prefs[k])}
            onClick={turnOffAll}
          >
            {t("org.settings.notifications.turnOffAll")}
          </button>
        </div>
      </SettingsCard>
    </>
  );
}

// ─────────────────────────────────────────────
// 프로필. 이름(모든 워크스페이스 공통)과 이 워크스페이스의 직함
// ─────────────────────────────────────────────
export function ProfileForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: { name: string; title: string; email: string };
}) {
  const t = useT();
  const [name, setName] = useState(initial.name);
  const [title, setTitle] = useState(initial.title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(t("errors.msg.nameRequired"));
    setBusy(true);
    const r = await updateProfile(workspaceId, { name, title });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saved(t("org.settings.profile.saved"));
  };

  return (
    <SettingsCard id="profile-card" title={t("org.settings.section.profile")}>
      <form onSubmit={submit} method="post" className="grid gap-(--s-4)">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">{t("org.settings.profile.name")}</Label>
          <Input
            id="profile-name"
            value={name}
            maxLength={80}
            autoComplete="name"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "profile-error" : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-title">{t("org.settings.profile.jobTitle")}</Label>
          <Input
            id="profile-title"
            value={title}
            maxLength={80}
            placeholder={t("org.settings.profile.jobTitlePlaceholder")}
            aria-describedby="profile-title-hint"
            onChange={(e) => setTitle(e.target.value)}
          />
          <p id="profile-title-hint" className="text-(length:--fs-xs) text-(--text-3)">
            {t("org.settings.profile.jobTitleHint")}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">{t("org.settings.profile.email")}</Label>
          <Input id="profile-email" value={initial.email} readOnly disabled aria-describedby="profile-email-hint" />
          <p id="profile-email-hint" className="text-(length:--fs-xs) text-(--text-3)">
            {t("org.settings.profile.emailHint")}
          </p>
        </div>
        <FieldError id="profile-error" message={error} />
        <div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {t("common.action.save")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────
// 시간대. 구성원 프로필에 현지 시각으로 보인다. 화면의 날짜 표시는 Asia/Seoul 기준이다
// ─────────────────────────────────────────────
export function TimezoneForm({ workspaceId, initial }: { workspaceId: string; initial: string }) {
  const t = useT();
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const [tz, setTz] = useState(initial);
  const [busy, setBusy] = useState(false);

  const change = async (next: string) => {
    const prev = tz;
    setTz(next);
    setBusy(true);
    const r = await updateTimezone(workspaceId, next);
    setBusy(false);
    if (!r.ok) {
      setTz(prev);
      return void toast.error(r.error);
    }
    saved(t("org.settings.timezone.saved", { tz: next }));
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="tz-select">{t("org.settings.timezone.label")}</Label>
      <Select value={tz} onValueChange={change} disabled={busy}>
        <SelectTrigger id="tz-select" className="w-full sm:w-72" aria-describedby="tz-hint">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
            <SelectItem key={z} value={z}>
              {z}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="tz-hint" className="text-(length:--fs-xs) text-(--text-3)">
        {t("org.settings.timezone.hint")}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 비밀번호. 오래된 세션이면 메일로 받은 인증 코드를 한 번 더 입력한다
// ─────────────────────────────────────────────
export function PasswordForm() {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  // 인증 코드 칸은 한 번 요구되면 변경에 성공할 때까지 남긴다(코드가 틀려도 다시 입력할 수 있게)
  const [needNonce, setNeedNonce] = useState(false);
  const [state, dispatch, pending] = useActionState<PasswordState, FormData>(async (prev, fd) => {
    const r = await changePassword(prev, fd);
    if (r && "needNonce" in r) setNeedNonce(true);
    if (r && "ok" in r) {
      setNeedNonce(false);
      saved(t("org.settings.password.saved"));
      formRef.current?.reset();
    }
    return r;
  }, null);
  const error = state && "error" in state ? state.error : null;
  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <SettingsCard id="password" title={t("org.settings.password.title")}>
      <form
        ref={formRef}
        method="post"
        className="grid gap-(--s-4)"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => dispatch(fd));
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="pw-new">{t("org.settings.password.newPassword")}</Label>
          <Input
            id="pw-new"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            aria-invalid={!!fieldError("password") || undefined}
            aria-describedby="pw-new-hint pw-new-error"
          />
          <p id="pw-new-hint" className="text-(length:--fs-xs) text-(--text-3)">
            {t("org.settings.password.hint", { min: MIN_PASSWORD_LENGTH })}
          </p>
          <FieldError id="pw-new-error" message={fieldError("password")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pw-confirm">{t("org.settings.password.confirm")}</Label>
          <Input
            id="pw-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!fieldError("confirm") || undefined}
            aria-describedby="pw-confirm-error"
          />
          <FieldError id="pw-confirm-error" message={fieldError("confirm")} />
        </div>
        {needNonce && (
          <div className="grid gap-1.5">
            <Label htmlFor="pw-nonce">{t("org.settings.password.nonce")}</Label>
            <Input
              id="pw-nonce"
              name="nonce"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              aria-invalid={!!fieldError("nonce") || undefined}
              aria-describedby="pw-nonce-hint pw-nonce-error"
            />
            <p id="pw-nonce-hint" role="status" className="text-(length:--fs-xs) text-(--text-3)">
              {t("org.settings.password.nonceHint")}
            </p>
            <FieldError id="pw-nonce-error" message={fieldError("nonce")} />
          </div>
        )}
        <FieldError id="pw-error" message={error && !error.field ? error.message : undefined} />
        <div>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {t("org.settings.password.submit")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

// ─────────────────────────────────────────────
// 로그인 세션. 실제 인증 상태만 보인다
// ─────────────────────────────────────────────
export function SessionsPanel({ email, lastSignIn }: { email: string; lastSignIn: string | null }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const others = async () => {
    setBusy(true);
    const r = await signOutOthers();
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    saved(t("org.settings.sessions.signedOutOthers"));
  };
  return (
    <SettingsCard
      id="sessions"
      title={t("org.settings.sessions.title")}
      description={t("org.settings.sessions.description")}
    >
      <div className="grid gap-1 text-(length:--fs-base)">
        <p className="text-(--text)">{email}</p>
        <p className="text-(length:--fs-sm) text-(--text-3)">
          {t("org.settings.sessions.lastSignIn")}{" "}
          {lastSignIn ? (
            <time dateTime={lastSignIn}>
              {new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(
                new Date(lastSignIn),
              )}
            </time>
          ) : (
            t("org.settings.sessions.noRecord")
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} aria-busy={busy} onClick={others}>
          {t("org.settings.sessions.signOutOthers")}
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="destructive">
            {t("org.settings.sessions.signOutHere")}
          </Button>
        </form>
      </div>
    </SettingsCard>
  );
}
