// 오류 상태 안내. 403(접근 권한 없음)과 일반 오류에 쓰고, 필요하면 다시 시도·이동 액션을 받는다
import { ShieldAlert, TriangleAlert } from "lucide-react";

const PRESETS = {
  forbidden: {
    icon: ShieldAlert,
    title: "접근 권한이 없습니다",
    description: "이 화면을 볼 권한이 없습니다. 필요하면 워크스페이스 관리자에게 요청하세요.",
  },
  error: {
    icon: TriangleAlert,
    title: "문제가 발생했습니다.",
    description: "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려 주세요.",
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
  const preset = PRESETS[kind];
  const Icon = preset.icon;
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-(--gutter) py-(--s-12) text-center">
      <span className="mb-(--s-3) inline-flex size-10 items-center justify-center rounded-full bg-(--red-soft) text-(--red)">
        <Icon aria-hidden size={18} strokeWidth={1.8} />
      </span>
      <h1 className="text-(length:--fs-xl) font-semibold text-(--text)">{title ?? preset.title}</h1>
      <p className="mt-1 max-w-md text-(length:--fs-base) text-(--text-3)">{description ?? preset.description}</p>
      {action && <div className="mt-(--s-4) flex gap-2">{action}</div>}
    </div>
  );
}
