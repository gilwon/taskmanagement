"use client"
// shadcn/ui switch 컴포넌트. 동작은 Radix 그대로, 모양·모션은 Lucian #013(늘어나는 손잡이, ✕→✓ 다시 그리기)이다

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"
import { motionOff } from "@/lib/prefs/prefs"
import "./lucian-toggles.css"

function Switch({
  className,
  size = "default",
  onClick,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  const [stretch, setStretch] = React.useState(false)
  const timer = React.useRef<number>(undefined)
  React.useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn("peer u013-sw", stretch && "is-stretch", className)}
      onClick={(e) => {
        onClick?.(e)
        // 눌러서 바꿀 때만 늘인다. 첫 그리기나 바깥에서 바뀐 값에는 재생하지 않는다
        if (e.defaultPrevented || motionOff()) return
        setStretch(true)
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setStretch(false), 170)
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="u013-knob">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="u013-x" d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          <path className="u013-v" d="M5.5 12.5l4.5 4.5 8.5-9" />
        </svg>
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
