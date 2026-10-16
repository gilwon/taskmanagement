"use client"
// shadcn/ui sonner 컴포넌트. CLI로 생성한 파일이다. 테마는 환경설정 provider 값을 따른다

import { useEffect, useRef } from "react"
import { usePrefs } from "@/lib/prefs/provider"
import { useT } from "@/lib/i18n/client"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { prefs } = usePrefs()
  const t = useT()
  const ref = useRef<HTMLElement>(null)

  // sonner는 컨테이너에 aria-live만 준다. 상태 알림 역할(role=status)을 명시한다
  useEffect(() => {
    ref.current?.setAttribute("role", "status")
  }, [])

  return (
    <Sonner
      ref={ref}
      theme={prefs.theme}
      position="bottom-right"
      duration={4200}
      containerAriaLabel={t("common.toaster.label")}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
        closeButtonAriaLabel: t("common.toaster.close"),
      }}
      {...props}
    />
  )
}

export { Toaster }
