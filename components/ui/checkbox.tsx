"use client"
// shadcn/ui checkbox 컴포넌트. 동작은 Radix 그대로, 모양·모션은 Lucian #014(원 채우기, 체크 그리기)이다

import * as React from "react"
import { cn } from "cn"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import "./lucian-toggles.css"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn("peer u014-box", className)}
      {...props}
    >
      {/* Indicator 안에 두면 해제 때 사라져 지우는 모션이 없어진다. 늘 그려 두고 CSS가 aria-checked로 그린다 */}
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <path d="M7.5 13.5l3.8 3.8 7.4-8" />
      </svg>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
