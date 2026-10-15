"use client";
// 설정 화면의 입력 폼. 워크스페이스 일반·위험 구역, 화면 설정, 알림, 프로필, 시간대, 비밀번호, 로그인 세션
import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { SettingsCard, UnavailableBadge } from "@/components/org/settings-parts";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { signOut } from "@/lib/auth/actions";
import { MSG } from "@/lib/auth/errors";
import { MIN_PASSWORD_LENGTH, SLUG_RE } from "@/lib/auth/rules";
import { NOTIFICATION_TYPE_LABELS, NOTIF_PREF_DESCRIPTIONS, PREF_LABELS } from "@/lib/i18n/labels";
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
import { usePrefs } from "@/lib/prefs/provider";

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
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<{ field: "name" | "slug" | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== workspace.name || slug.trim() !== workspace.slug;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    if (!name.trim()) return setError({ field: "name", message: MSG.workspaceNameRequired });
    if (!SLUG_RE.test(slug.trim().toLowerCase())) return setError({ field: "slug", message: MSG.slugInvalid });
    setBusy(true);
    const r = await updateWorkspace(workspace.id, { name, slug });
    setBusy(false);
    if (!r.ok) {
      const field = r.error.includes("URL") ? "slug" : r.error.includes("이름") ? "name" : null;
      return setError({ field, message: r.error });
    }
    saved("워크스페이스 설정을 저장했습니다.");
    if (r.data.slug !== workspace.slug) router.replace(`/${r.data.slug}/settings/general`);
  };

  return (
    <SettingsCard id="ws-general" title="워크스페이스" description={canEdit ? undefined : "소유자와 관리자만 바꿀 수 있습니다."}>
      <form onSubmit={submit} method="post" className="grid gap-(--s-4)">
        <div className="grid gap-1.5">
          <Label htmlFor="ws-name">이름</Label>
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
          <Label htmlFor="ws-slug">URL</Label>
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
            URL을 바꾸면 예전 주소의 링크는 더 이상 열리지 않습니다.
          </p>
        </div>
        <FieldError id="ws-error" message={error?.message} />
        {canEdit && (
          <div>
            <Button type="submit" disabled={busy || !dirty} aria-busy={busy}>
              저장
            </Button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}

// 위험 구역. 소유자에게만 보인다. URL을 그대로 입력해야 지운다
export function DangerZone({ workspace }: { workspace: { id: string; slug: string; name: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsCard
      id="ws-danger"
      tone="danger"
      title="위험 구역"
      description="워크스페이스를 삭제하면 모든 프로젝트·작업·댓글·파일이 영구히 지워지고 되돌릴 수 없습니다."
    >
      <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          워크스페이스 삭제
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="워크스페이스 삭제"
        description={`${workspace.name}의 모든 데이터와 파일을 영구히 삭제합니다. 다른 구성원도 더 이상 들어올 수 없습니다.`}
        confirmLabel="영구 삭제"
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
const PREF_ROWS: { key: keyof typeof PREF_OPTIONS; label: string }[] = [
  { key: "theme", label: "테마" },
  { key: "accent", label: "강조색" },
  { key: "density", label: "목록 밀도" },
  { key: "side", label: "사이드바 밀도" },
  { key: "motion", label: "애니메이션" },
];

export function AppearanceForm() {
  const { prefs, setPref } = usePrefs();
  return (
    <SettingsCard id="appearance" title="화면 설정" description="이 브라우저에만 저장되고 바로 반영됩니다.">
      {PREF_ROWS.map(({ key, label }) => {
        const labels = PREF_LABELS[key] as Record<string, string>;
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
                  {labels[v]}
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
// 알림. 이메일·푸시는 발송 서비스가 없어 비활성(spec R23). 앱 내 알림은 종류별로 끄고 켠다
// ─────────────────────────────────────────────
// update 알림은 아직 보내는 경로가 없어 켜고 끄는 컨트롤을 두지 않는다
const LIVE_NOTIF_KEYS = NOTIF_KEYS.filter((k) => k !== "update");

export function NotificationsForm({ workspaceId, initial }: { workspaceId: string; initial: NotifPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async (key: keyof NotifPrefs, value: boolean) => {
    const prev = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setBusy(true);
    const r = await saveNotifPrefs(workspaceId, next);
    setBusy(false);
    if (!r.ok) {
      setPrefs(prev);
      return void toast.error(r.error);
    }
    saved(`${NOTIFICATION_TYPE_LABELS[key]} 알림을 ${value ? "켰습니다" : "껐습니다"}.`);
  };

  return (
    <>
      <SettingsCard id="notif-app" title="앱 내 알림" description="이 워크스페이스에서 받을 알림 종류를 고릅니다. 끈 종류는 새로 만들어지지 않습니다.">
        {LIVE_NOTIF_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <Label htmlFor={`notif-${k}`} className="grid gap-0.5 font-normal">
              <span className="text-(length:--fs-base) text-(--text)">{NOTIFICATION_TYPE_LABELS[k]}</span>
              <span className="text-(length:--fs-xs) text-(--text-3)">{NOTIF_PREF_DESCRIPTIONS[k]}</span>
            </Label>
            <Switch id={`notif-${k}`} checked={prefs[k]} disabled={busy} onCheckedChange={(v) => toggle(k, v)} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <span className="text-(length:--fs-base) text-(--text-2)">{NOTIFICATION_TYPE_LABELS.update}</span>
            <span className="text-(length:--fs-xs) text-(--text-3)">작업 변경 알림은 아직 보내지 않습니다.</span>
          </div>
          <UnavailableBadge />
        </div>
      </SettingsCard>
      <SettingsCard
        id="notif-external"
        title="이메일·푸시 알림"
        description="메일·푸시 발송 서비스가 연결되어 있지 않아 지금은 켤 수 없습니다. 알림은 앱 안의 수신함과 알림 화면에서 확인하세요."
      >
        {(["이메일 알림", "푸시 알림"] as const).map((label, i) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <Label htmlFor={`notif-ext-${i}`} className="flex items-center gap-2 font-normal text-(--text-2)">
              {label}
              <UnavailableBadge />
            </Label>
            <Switch id={`notif-ext-${i}`} checked={false} disabled aria-describedby="notif-external-title" />
          </div>
        ))}
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
  const [name, setName] = useState(initial.name);
  const [title, setTitle] = useState(initial.title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(MSG.nameRequired);
    setBusy(true);
    const r = await updateProfile(workspaceId, { name, title });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saved("프로필을 저장했습니다.");
  };

  return (
    <SettingsCard id="profile-card" title="프로필">
      <form onSubmit={submit} method="post" className="grid gap-(--s-4)">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">이름</Label>
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
          <Label htmlFor="profile-title">직함</Label>
          <Input
            id="profile-title"
            value={title}
            maxLength={80}
            placeholder="예: 프론트엔드 엔지니어"
            aria-describedby="profile-title-hint"
            onChange={(e) => setTitle(e.target.value)}
          />
          <p id="profile-title-hint" className="text-(length:--fs-xs) text-(--text-3)">
            직함은 이 워크스페이스에서만 보입니다.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">이메일</Label>
          <Input id="profile-email" value={initial.email} readOnly disabled aria-describedby="profile-email-hint" />
          <p id="profile-email-hint" className="text-(length:--fs-xs) text-(--text-3)">
            이메일 변경은 제공하지 않습니다.
          </p>
        </div>
        <FieldError id="profile-error" message={error} />
        <div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            저장
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
    saved(`시간대를 ${next}(으)로 저장했습니다.`);
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="tz-select">내 시간대</Label>
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
        다른 구성원이 내 프로필에서 현지 시각을 볼 수 있습니다.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 비밀번호. 오래된 세션이면 메일로 받은 인증 코드를 한 번 더 입력한다
// ─────────────────────────────────────────────
export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  // 인증 코드 칸은 한 번 요구되면 변경에 성공할 때까지 남긴다(코드가 틀려도 다시 입력할 수 있게)
  const [needNonce, setNeedNonce] = useState(false);
  const [state, dispatch, pending] = useActionState<PasswordState, FormData>(async (prev, fd) => {
    const r = await changePassword(prev, fd);
    if (r && "needNonce" in r) setNeedNonce(true);
    if (r && "ok" in r) {
      setNeedNonce(false);
      saved("비밀번호를 바꿨습니다.");
      formRef.current?.reset();
    }
    return r;
  }, null);
  const error = state && "error" in state ? state.error : null;
  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <SettingsCard id="password" title="비밀번호 변경">
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
          <Label htmlFor="pw-new">새 비밀번호</Label>
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
            영문과 숫자를 섞어 {MIN_PASSWORD_LENGTH}자 이상
          </p>
          <FieldError id="pw-new-error" message={fieldError("password")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
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
            <Label htmlFor="pw-nonce">인증 코드</Label>
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
              로그인한 지 오래되어 본인 확인이 필요합니다. 계정 이메일로 보낸 인증 코드를 입력하고 다시 저장하세요.
            </p>
            <FieldError id="pw-nonce-error" message={fieldError("nonce")} />
          </div>
        )}
        <FieldError id="pw-error" message={error && !error.field ? error.message : undefined} />
        <div>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            비밀번호 변경
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
  const [busy, setBusy] = useState(false);
  const others = async () => {
    setBusy(true);
    const r = await signOutOthers();
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    saved("다른 기기의 로그인을 모두 끝냈습니다.");
  };
  return (
    <SettingsCard
      id="sessions"
      title="현재 세션"
      description="다른 기기의 세션 목록은 제공하지 않습니다. 필요하면 다른 기기의 로그인을 한 번에 끝낼 수 있습니다."
    >
      <div className="grid gap-1 text-(length:--fs-base)">
        <p className="text-(--text)">{email}</p>
        <p className="text-(length:--fs-sm) text-(--text-3)">
          이 브라우저 · 마지막 로그인{" "}
          {lastSignIn ? (
            <time dateTime={lastSignIn}>
              {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(
                new Date(lastSignIn),
              )}
            </time>
          ) : (
            "기록 없음"
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} aria-busy={busy} onClick={others}>
          다른 기기에서 모두 로그아웃
        </Button>
        <form action={signOut}>
          <Button type="submit" variant="destructive">
            이 기기에서 로그아웃
          </Button>
        </form>
      </div>
    </SettingsCard>
  );
}
