"use client";
// 받은 초대 목록. 수락하면 그 워크스페이스 홈으로 가고, 거절하면 목록에서 빠진다
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import { acceptInvite, declineInvite } from "@/lib/org/actions";
import type { MyInvite } from "@/lib/org/queries";

export function InvitesList({ invites }: { invites: MyInvite[] }) {
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
    toast.success(`${i.workspaceName}에 들어왔습니다.`);
    router.push(`/${r.data.slug}/home`);
  };

  const decline = async (i: MyInvite) => {
    setBusy(i.id);
    setError(null);
    const r = await declineInvite(i.id);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    announce(`${i.workspaceName} 초대를 거절했습니다.`);
  };

  if (invites.length === 0) {
    return <p className="text-(length:--fs-base) text-(--text-3)">받은 초대가 없습니다.</p>;
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
              <p className="text-(length:--fs-xs) text-(--text-3)">{ROLE_LABELS[i.role]}(으)로 초대됨</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => decline(i)}
                aria-label={`${i.workspaceName} 초대 거절`}
              >
                거절
              </Button>
              <Button
                size="sm"
                disabled={busy !== null}
                aria-busy={busy === i.id}
                onClick={() => accept(i)}
                aria-label={`${i.workspaceName} 초대 수락`}
              >
                수락
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
