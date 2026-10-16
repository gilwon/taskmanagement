"use client";
// 필터 필드별 선택지. 구성원·프로젝트는 작업 store에서 가져온다
import { useMemo } from "react";
import { ProjectIcon } from "@/components/shell/project-icon";
import { AssigneeAvatar, PriorityIcon, StatusIcon } from "@/components/tasks/parts/display";
import { useTasksOptional } from "@/components/tasks/task-store";
import { useT } from "@/lib/i18n/client";
import { TASK_LABEL_LABELS } from "@/lib/i18n/labels";
import { DATE_RANGES, DUE_BUCKETS, type FilterField } from "@/lib/tasks/types";
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/tasks/view";

export type FilterOption = { value: string; label: string; icon?: React.ReactNode };

export function useFilterOptions(): (field: FilterField) => FilterOption[] {
  const t = useT();
  const store = useTasksOptional();
  const members = store?.members;
  const items = store?.items;
  // 프로젝트 선택지는 화면에 있는 작업의 프로젝트
  const projects = useMemo(() => {
    const map = new Map<string, NonNullable<typeof items>[number]["project"]>();
    for (const item of items ?? []) map.set(item.project.id, item.project);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [items]);

  return useMemo(
    () => (field: FilterField) => {
      switch (field) {
        case "status":
          return STATUS_ORDER.map((s) => ({
            value: s,
            label: t(`common.taskStatus.${s}`),
            icon: <StatusIcon status={s} className="size-3.5" />,
          }));
        case "priority":
          return PRIORITY_ORDER.map((p) => ({
            value: p,
            label: t(`common.taskPriority.${p}`),
            icon: <PriorityIcon priority={p} className="size-3.5" />,
          }));
        case "assignee":
          return [
            { value: "none", label: t("common.unassigned"), icon: <AssigneeAvatar assignee={null} size={18} /> },
            ...(members ?? []).map((m) => ({
              value: m.id,
              label: m.name,
              icon: <AssigneeAvatar assignee={{ id: m.id, name: m.name, color: m.color }} size={18} />,
            })),
          ];
        case "due":
          return DUE_BUCKETS.map((b) => ({ value: b, label: t(`common.dueBucket.${b}`) }));
        case "project":
          return projects.map((p) => ({
            value: p.id,
            label: p.name,
            icon: <ProjectIcon icon={p.icon} color={p.color} size={16} />,
          }));
        case "labels":
          return (Object.keys(TASK_LABEL_LABELS) as (keyof typeof TASK_LABEL_LABELS)[]).map((l) => ({
            value: l,
            label: t(`common.taskLabel.${l}`),
          }));
        case "created":
        case "updated":
          return DATE_RANGES.map((r) => ({ value: r, label: t(`common.dateRange.${r}`) }));
      }
    },
    [members, projects, t],
  );
}
