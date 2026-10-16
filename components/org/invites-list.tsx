"use client";
// 받은 초대 목록. 수락하면 그 워크스페이스 홈으로 가고, 거절하면 목록에서 빠진다
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { acceptInvite, declineInvite } from "@/lib/org/actions";
import type { MyInvite } from "@/lib/org/queries";

export function InvitesList({ invites }: { invites: MyInvite[] }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async (i: MyInvite) => {
    setBusy(i.id);
    setError(null);
    const r = await acceptInvite(i.id);
    if (!r.ok) {
      setBusy(null);
      return setError(r.error);
    }
    toast.success(t("org.myInvites.joined", { ws: i.workspaceName }));
    router.push(`/${r.data.slug}/home`);
  };

  const decline = async (i: MyInvite) => {
    setBusy(i.id);
    setError(null);
    const r = await declineInvite(i.id);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    announce(t("org.myInvites.declined", { ws: i.workspaceName }));
  };

  if (invites.length === 0) {
    return <p className="text-(length:--fs-base) text-(--text-3)">{t("org.myInvites.empty")}</p>;
  }
  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-(--r) bg-(--red-soft) px-(--s-3) py-(--s-2) text-(length:--fs-sm) text-(--red)">
          {error}
        </p>
      )}
      <ul className="divide-y divide-(--divider) rounded-(--r) border border-(--border)">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-(--s-3) py-(--s-3)">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-(--text)">{i.workspaceName}</p>
              <p className="text-(length:--fs-xs) text-(--text-3)">{t("org.myInvites.invitedAs", { role: t(`common.role.${i.role}`) })}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => decline(i)}
                aria-label={t("org.myInvites.declineOf", { ws: i.workspaceName })}
              >
                {t("org.myInvites.decline")}
              </Button>
              <Button
                size="sm"
                disabled={busy !== null}
                aria-busy={busy === i.id}
                onClick={() => accept(i)}
                aria-label={t("org.myInvites.acceptOf", { ws: i.workspaceName })}
              >
                {t("org.myInvites.accept")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
