"use client";
// 필터 필드별 선택지. 구성원·프로젝트는 작업 store에서 가져온다
import { useMemo } from "react";
import { ProjectIcon } from "@/components/shell/project-icon";
import { AssigneeAvatar, PriorityIcon, StatusIcon } from "@/components/tasks/parts/display";
import { useTasksOptional } from "@/components/tasks/task-store";
import {
  DATE_RANGE_LABELS,
  DUE_BUCKET_LABELS,
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  UNASSIGNED_LABEL,
} from "@/lib/i18n/labels";
import { DATE_RANGES, DUE_BUCKETS, type FilterField } from "@/lib/tasks/types";
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/tasks/view";

export type FilterOption = { value: string; label: string; icon?: React.ReactNode };

export function useFilterOptions(): (field: FilterField) => FilterOption[] {
  const store = useTasksOptional();
  const members = store?.members;
  const items = store?.items;
  // 프로젝트 선택지는 화면에 있는 작업의 프로젝트
  const projects = useMemo(() => {
    const map = new Map<string, NonNullable<typeof items>[number]["project"]>();
    for (const t of items ?? []) map.set(t.project.id, t.project);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [items]);

  return useMemo(
    () => (field: FilterField) => {
      switch (field) {
        case "status":
          return STATUS_ORDER.map((s) => ({
            value: s,
            label: TASK_STATUS_LABELS[s],
            icon: <StatusIcon status={s} className="size-3.5" />,
          }));
        case "priority":
          return PRIORITY_ORDER.map((p) => ({
            value: p,
            label: TASK_PRIORITY_LABELS[p],
            icon: <PriorityIcon priority={p} className="size-3.5" />,
          }));
        case "assignee":
          return [
            { value: "none", label: UNASSIGNED_LABEL, icon: <AssigneeAvatar assignee={null} size={18} /> },
            ...(members ?? []).map((m) => ({
              value: m.id,
              label: m.name,
              icon: <AssigneeAvatar assignee={{ id: m.id, name: m.name, color: m.color }} size={18} />,
            })),
          ];
        case "due":
          return DUE_BUCKETS.map((b) => ({ value: b, label: DUE_BUCKET_LABELS[b] }));
        case "project":
          return projects.map((p) => ({
            value: p.id,
            label: p.name,
            icon: <ProjectIcon icon={p.icon} color={p.color} size={16} />,
          }));
        case "labels":
          return (Object.keys(TASK_LABEL_LABELS) as (keyof typeof TASK_LABEL_LABELS)[]).map((l) => ({
            value: l,
            label: TASK_LABEL_LABELS[l],
          }));
        case "created":
        case "updated":
          return DATE_RANGES.map((r) => ({ value: r, label: DATE_RANGE_LABELS[r] }));
      }
    },
    [members, projects],
  );
}
