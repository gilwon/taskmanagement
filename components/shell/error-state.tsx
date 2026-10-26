"use client";
// 오류 상태 안내. 403(접근 권한 없음)과 일반 오류에 쓰고, 필요하면 다시 시도·이동 액션을 받는다
// 일반 오류의 플러그 그림과 다시 시도 버튼은 Lucian UX/UI Prompt #090 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#090
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { motionOff } from "@/lib/prefs/prefs";
import { cn } from "@/lib/utils";
import "./lucian-error.css";

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

// 일반 오류 카드. 다시 시도를 누르면 플러그가 다가가 흔들리고, 오류가 그대로면 불꽃과 함께 튕겨 나온다.
// 다시 시도가 통하면 오류 경계가 이 카드를 걷어내므로 성공 모션은 두지 않는다
function PlugError({
  title,
  description,
  action,
  onRetry,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  // 오류 경계의 retry. 주면 Lucian 다시 시도 버튼을 보인다
  onRetry?: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<"wait" | "try">("wait");
  const [failed, setFailed] = useState(false);
  const [zap, setZap] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const retry = () => {
    if (state === "try" || !onRetry) return;
    setState("try");
    setFailed(false);
    setZap(false);
    onRetry();
    // 이 시간이 지나도 카드가 남아 있으면 다시 연결하지 못한 것이다
    timer.current = window.setTimeout(() => {
      setState("wait");
      setFailed(true);
      setZap(true);
      if (!motionOff()) {
        errRef.current?.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "none" }],
          { duration: 420, easing: "ease-out" },
        );
      }
    }, motionOff() ? 400 : 1500);
  };

  const trying = state === "try";
  return (
    <div role="alert" className="px-(--gutter) py-(--s-12)">
      <div className={cn("ux u090 mx-auto", zap && "zap")} data-s={state}>
        <div className="u090-h">
          <span className="u090-pill" style={{ "--c": trying ? "var(--ux-warn)" : "var(--ux-danger)" } as React.CSSProperties}>
            {trying ? t("common.errorCard.statusTry") : t("common.errorCard.statusWait")}
          </span>
        </div>
        <div className="u090-stage">
          <div ref={errRef} className="u090-err">
            <svg className="u090-plug" viewBox="0 0 220 70" aria-hidden="true">
              <g className="u090-L">
                <path className="u090-cord" d="M-14 54C24 54 40 35 72 35" />
                <path className="u090-pr" d="M100 28h14M100 42h14" />
                <rect className="u090-bd" x="68" y="19" width="34" height="32" rx="8" />
              </g>
              <g className="u090-spark">
                <path d="M121 20l-2-7M129 24l5-5M113 24l-5-5M121 50l-2 7M129 46l5 5M113 46l-5 5" />
              </g>
              <g className="u090-R">
                <rect className="u090-bd" x="124" y="17" width="38" height="36" rx="9" />
                <path className="u090-hole" d="M124 28h6M124 42h6" />
                <circle className="u090-led" cx="153" cy="25" r="3" />
                <path className="u090-cord" d="M162 35C188 35 194 16 236 16" />
              </g>
            </svg>
            <h1 className="u090-t">{title}</h1>
            <p className="u090-s">{description}</p>
            <div className="u090-at">
              <span aria-live="polite">{trying ? t("common.errorCard.trying") : failed ? t("common.errorCard.failed") : ""}</span>
            </div>
            {action && <div className="mt-(--s-3) flex gap-2">{action}</div>}
          </div>
        </div>
        {onRetry && (
          <button type="button" className="u090-go" aria-disabled={trying} onClick={retry}>
            <svg className="u090-ring" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="8" />
              <circle cx="10" cy="10" r="8" pathLength="100" />
            </svg>
            <span>{trying ? t("common.errorCard.tryingButton") : t("common.action.retry")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ErrorState({
  kind = "error",
  title,
  description,
  action,
  onRetry,
}: {
  kind?: keyof typeof PRESETS;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  // 오류 경계의 retry(kind=error에서만). 주면 action 대신 Lucian 다시 시도 버튼을 쓴다
  onRetry?: () => void;
}) {
  const t = useT();
  const preset = PRESETS[kind];
  if (kind === "error") {
    return (
      <PlugError
        title={title ?? t(preset.title)}
        description={description ?? t(preset.description)}
        action={action}
        onRetry={onRetry}
      />
    );
  }
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
