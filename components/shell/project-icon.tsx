"use client";
// 프로젝트·팀 아이콘 타일과 프로젝트 상태 점. DB의 아이콘 이름을 Lucide 컴포넌트에 매핑한다(META §4)
import {
  Briefcase,
  Building2,
  Code,
  Component,
  Folder,
  Globe,
  Heart,
  Layers,
  LayoutGrid,
  Megaphone,
  Palette,
  Rocket,
  Smartphone,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/lib/database.types";
import { useT } from "@/lib/i18n/client";
import { colorHex } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  smartphone: Smartphone,
  megaphone: Megaphone,
  rocket: Rocket,
  component: Component,
  "building-2": Building2,
  "layout-grid": LayoutGrid,
  palette: Palette,
  code: Code,
  briefcase: Briefcase,
  target: Target,
  layers: Layers,
  zap: Zap,
  heart: Heart,
  folder: Folder,
  sparkles: Sparkles,
};

// 장식 아이콘이라 스크린리더에서 숨긴다. 이름은 옆 텍스트가 알린다
export function ProjectIcon({
  icon,
  color,
  size = 18,
  className,
}: {
  icon: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Folder;
  const hex = colorHex(color);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-(--r-xs)", className)}
      style={{
        width: size,
        height: size,
        color: hex,
        background: `color-mix(in srgb, ${hex} 16%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.67)} strokeWidth={1.8} />
    </span>
  );
}

// META에 상태 색 정의가 없어 의미가 가까운 토큰을 고른다
const STATUS_COLOR: Record<Enums<"project_status">, string> = {
  planning: "var(--st-todo)",
  active: "var(--green)",
  risk: "var(--red)",
  hold: "var(--amber)",
  complete: "var(--blue)",
};

export function ProjectStatusDot({ status }: { status: Enums<"project_status"> }) {
  const t = useT();
  const label = t(`common.projectStatus.${status}`);
  return (
    <span
      role="img"
      aria-label={t("shell.project.status", { status: label })}
      title={label}
      className="inline-block size-1.5 shrink-0 rounded-full"
      style={{ background: STATUS_COLOR[status] }}
    />
  );
}
