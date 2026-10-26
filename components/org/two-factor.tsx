"use client";
// 설정 > 2단계 인증. TOTP 요소의 등록(QR·시크릿·6자리 확인)과 해제(확인창)를 브라우저 Supabase 클라이언트로 처리한다
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { SettingsCard } from "@/components/org/settings-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTotpCode } from "@/lib/auth/mfa";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

type Enrolling = { id: string; qr: string; secret: string };

export function TwoFactor({ title }: { title: string }) {
  const t = useT();
  // null은 불러오는 중, string은 등록된 요소 id
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 상태를 읽고, 등록을 끝내지 않고 남은 요소(unverified)는 정리한다. 실패하면 undefined를 돌려준다
  const read = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return undefined;
    await Promise.all(
      data.all.filter((f) => f.factor_type === "totp" && f.status === "unverified").map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
    );
    return data.totp[0]?.id ?? null;
  }, []);

  const apply = (id: string | null | undefined) => {
    setLoadFailed(id === undefined);
    if (id !== undefined) setFactorId(id);
  };

  useEffect(() => {
    void read().then(apply);
  }, [read]);

  const start = async () => {
    setBusy(true);
    const supabase = createClient();
    // 같은 이름의 미검증 요소가 남아 있으면 enroll이 실패하므로 먼저 정리한다
    apply(await read());
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) return void toast.error(t("org.settings.twoFactor.failed"));
    setCode("");
    setCodeError(null);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const cancel = async () => {
    if (enrolling) await createClient().auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling || busy) return;
    const digits = normalizeTotpCode(code);
    if (!digits) return setCodeError(t("org.settings.twoFactor.codeInvalid"));
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: digits });
    setBusy(false);
    if (error) return setCodeError(t("org.settings.twoFactor.codeWrong"));
    setFactorId(enrolling.id);
    setEnrolling(null);
    toast.success(t("org.settings.twoFactor.enabled"));
  };

  // 해제는 aal2 세션이 필요하다. 아니면 다시 로그인하도록 안내한다
  const disable = async () => {
    if (!factorId) return null;
    const { error } = await createClient().auth.mfa.unenroll({ factorId });
    if (error) return error.code === "insufficient_aal" ? t("org.settings.twoFactor.reauth") : t("org.settings.twoFactor.failed");
    setFactorId(null);
    toast.success(t("org.settings.twoFactor.disabled"));
    return null;
  };

  const on = typeof factorId === "string";
  return (
    <SettingsCard title={title} description={t("org.settings.twoFactor.description")}>
      {loadFailed ? (
        <p role="alert" className="text-(length:--fs-sm) text-(--red)">
          {t("org.settings.twoFactor.loadError")}
        </p>
      ) : factorId === undefined ? null : enrolling ? (
        <form onSubmit={verify} method="post" className="grid gap-(--s-4)">
          <p className="text-(length:--fs-sm) text-(--text-2)">{t("org.settings.twoFactor.scanHint")}</p>
          {/* qr_code는 Auth 서버가 주는 SVG data URI라 그대로 쓴다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt={t("org.settings.twoFactor.qrAlt")} width={192} height={192} className="size-48 rounded-(--r) bg-white p-2" />
          <div className="grid gap-1">
            <p className="text-(length:--fs-xs) text-(--text-3)">{t("org.settings.twoFactor.secretHint")}</p>
            <code className="w-fit rounded-(--r-xs) bg-(--surface-3) px-2 py-1 font-mono text-(length:--fs-sm) break-all text-(--text)">{enrolling.secret}</code>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="totp-code">{t("org.settings.twoFactor.code")}</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? "totp-code-error" : undefined}
              className="w-full sm:w-48"
              onChange={(ev) => {
                setCode(ev.target.value);
                setCodeError(null);
              }}
            />
            {codeError && (
              <p id="totp-code-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
                {codeError}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {t("org.settings.twoFactor.verify")}
            </Button>
            <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
              {t("common.action.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-(length:--fs-base) text-(--text-2)">{on ? t("org.settings.twoFactor.on") : t("org.settings.twoFactor.off")}</p>
          {on ? (
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
              {t("org.settings.twoFactor.disable")}
            </Button>
          ) : (
            <Button type="button" onClick={start} disabled={busy} aria-busy={busy}>
              {t("org.settings.twoFactor.setup")}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("org.settings.twoFactor.disableTitle")}
        description={t("org.settings.twoFactor.disableDescription")}
        confirmLabel={t("org.settings.twoFactor.disable")}
        onConfirm={disable}
      />
    </SettingsCard>
  );
}
