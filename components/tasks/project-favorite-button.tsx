"use client";
// 프로젝트 머리말의 즐겨찾기 별표 토글. 누르면 바로 바꿔 보이고 저장에 실패하면 되돌린다
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { setProjectFavorite } from "@/lib/projects/actions";
import { cn } from "@/lib/utils";

export function ProjectFavoriteButton({
  workspaceId,
  projectId,
  favorite,
}: {
  workspaceId: string;
  projectId: string;
  favorite: boolean;
}) {
  const t = useT();
  const router = useRouter();
  // 낙관 값은 그때의 서버 값(from)과 함께 둔다. 서버 값이 바뀌면(저장 반영, 사이드바에서 변경) 서버 값을 따른다
  const [optimistic, setOptimistic] = useState<{ on: boolean; from: boolean } | null>(null);
  const on = optimistic && optimistic.from === favorite ? optimistic.on : favorite;
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    // 저장 중 클릭은 무시한다. disabled로 막으면 포커스를 잃는다
    if (busy) return;
    const next = !on;
    setOptimistic({ on: next, from: favorite });
    setBusy(true);
    const r = await setProjectFavorite(workspaceId, projectId, next);
    setBusy(false);
    if (!r.ok) {
      setOptimistic(null);
      toast.error(r.error);
      return;
    }
    toast.success(next ? t("tasks.project.favoriteAdded") : t("tasks.project.favoriteRemoved"));
    // 사이드바 즐겨찾기 목록도 새 값을 받게 한다
    router.refresh();
  };

  return (
    <button
      type="button"
      // 상태는 aria-pressed로만 알린다. 이름까지 바꾸면 상태를 두 번 읽는다
      aria-pressed={on}
      aria-label={t("tasks.project.favorite")}
      aria-busy={busy || undefined}
      onClick={toggle}
      // 별표는 16px로 보이고 누르는 영역은 음수 margin으로 레이아웃을 그대로 둔 채 24px로 넓힌다
      className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-(--r-xs) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) aria-busy:cursor-default"
    >
      <Star
        aria-hidden
        size={16}
        strokeWidth={1.8}
        className={cn(on ? "fill-(--amber) text-(--amber)" : "text-(--text-4)")}
      />
    </button>
  );
}
