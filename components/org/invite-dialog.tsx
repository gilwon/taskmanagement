"use client";
// 구성원 초대 대화상자. 이메일 여러 개와 역할을 받아 초대를 만든다. 메일은 보내지 않으므로 받는 쪽 확인 방법을 안내한다
import { useState } from "react";
import { toast } from "sonner";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import { inviteMembers, type InviteOutcome } from "@/lib/org/actions";
import { INVITE_ROLES, MAX_INVITES } from "@/lib/org/rules";

type InviteRole = (typeof INVITE_ROLES)[number];

function InviteForm({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const t = useT();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<InviteOutcome[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await inviteMembers(workspaceId, emails, role);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const sent = r.data.filter((x) => x.ok);
    const bad = r.data.filter((x) => !x.ok);
    if (sent.length) {
      const msg = t("org.invite.sent", { count: sent.length });
      toast.success(msg);
      announce(msg);
    }
    if (bad.length === 0) return onDone();
    // 실패한 이메일만 남겨 고쳐 다시 보낼 수 있게 한다
    setFailed(bad);
    setEmails(bad.map((x) => x.email).join("\n"));
  };

  return (
    <form onSubmit={submit} method="post" className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("common.nav.inviteMember")}</DialogTitle>
        <DialogDescription>{t("org.invite.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="invite-emails">{t("org.invite.emails")}</Label>
        <Textarea
          id="invite-emails"
          autoFocus
          rows={4}
          value={emails}
          placeholder={t("org.invite.placeholder")}
          aria-invalid={!!error || failed.length > 0}
          aria-describedby="invite-emails-hint invite-emails-error"
          onChange={(e) => {
            setEmails(e.target.value);
            setError(null);
            setFailed([]);
          }}
        />
        <p id="invite-emails-hint" className="text-(length:--fs-xs) text-(--text-3)">
          {t("org.invite.limit", { max: MAX_INVITES })}
        </p>
        <div id="invite-emails-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
          {error}
          {failed.length > 0 && (
            <ul className="space-y-0.5">
              {failed.map((f) => (
                <li key={f.email} className="break-all">
                  {f.email} · {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="invite-role">{t("org.invite.role")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
          <SelectTrigger id="invite-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`common.role.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-(length:--fs-xs) text-(--text-3)">{t("org.invite.guestNote")}</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common.action.cancel")}
        </Button>
        <Button type="submit" disabled={busy || !emails.trim()} aria-busy={busy}>
          {t("org.invite.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// 열림 상태를 직접 쥐는 쪽(커맨드 팔레트, 쿼리 ?invite=1)이 쓴다. dialog를 렌더하고 setOpen(true)로 연다
export function useInviteDialog(workspaceId: string, initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        {open && <InviteForm workspaceId={workspaceId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
  return { open, setOpen, dialog };
}

// 버튼 하나를 trigger로 받아 여는 형태(홈·구성원 화면 머리말)
export function InviteDialog({ workspaceId, trigger }: { workspaceId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && <InviteForm workspaceId={workspaceId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
