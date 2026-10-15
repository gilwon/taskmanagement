"use client";
// 오류 상태 안내. 403(접근 권한 없음)과 일반 오류에 쓰고, 필요하면 다시 시도·이동 액션을 받는다
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/client";

const PRESETS = {
  forbidden: {
    icon: ShieldAlert,
    title: "shell.error.forbiddenTitle",
    description: "shell.error.forbiddenDescription",
  },
  error: {
    icon: TriangleAlert,
    title: "shell.error.title",
    description: "shell.error.description",
  },
} as const;

export function ErrorState({
  kind = "error",
  title,
  description,
  action,
}: {
  kind?: keyof typeof PRESETS;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const t = useT();
  const preset = PRESETS[kind];
  const Icon = preset.icon;
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-(--gutter) py-(--s-12) text-center">
      <span className="mb-(--s-3) inline-flex size-10 items-center justify-center rounded-full bg-(--red-soft) text-(--red)">
        <Icon aria-hidden size={18} strokeWidth={1.8} />
      </span>
      <h1 className="text-(length:--fs-xl) font-semibold text-(--text)">{title ?? t(preset.title)}</h1>
      <p className="mt-1 max-w-md text-(length:--fs-base) text-(--text-3)">{description ?? t(preset.description)}</p>
      {action && <div className="mt-(--s-4) flex gap-2">{action}</div>}
    </div>
  );
}
