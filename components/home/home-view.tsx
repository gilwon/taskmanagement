"use client";
// 홈 화면 본문. 머리말 버튼, stat 4칸, 내 작업·프로젝트 진행(왼쪽)과 다가오는 마감·최근 활동(오른쪽) 패널을 그린다.
// 숫자는 store 작업에서 계산하므로 완료 토글이 바로 반영된다
import { FolderPlus, Plus, UserPlus } from "lucide-react";
import { useMemo } from "react";
import { ActivityPanel, DeadlinesPanel, MyTasksPanel, ProjectProgressPanel } from "@/components/home/home-panels";
import { CountUp } from "@/components/home/parts";
import { PENDING_HINT } from "@/components/shell/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useNewTask } from "@/components/tasks/new-task";
import { useTasks } from "@/components/tasks/task-store";
import { HOME_STAT_LABELS, HOME_STAT_NOTES, NAV_LABELS } from "@/lib/i18n/labels";
import type { HomeActivity, HomeProject } from "@/lib/home/queries";
import { homeStats } from "@/lib/home/stats";
import { cn } from "@/lib/utils";

// 아직 동작하지 않는 버튼. 누를 수 없음을 알리고 이유를 툴팁으로 보인다(동작하는 척하지 않는다)
function PendingButton({ icon: Icon, label }: { icon: typeof Plus; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          aria-disabled="true"
          className="text-(--text-3) aria-disabled:opacity-60"
          onClick={(e) => e.preventDefault()}
        >
          <Icon aria-hidden strokeWidth={1.8} />
          <span className="hide-m">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{PENDING_HINT}</TooltipContent>
    </Tooltip>
  );
}

// 머리말 오른쪽 버튼. 구성원 초대·새 프로젝트는 P6에서 연결한다
export function HomeActions() {
  const { openNewTask } = useNewTask();
  return (
    <>
      <PendingButton icon={UserPlus} label={NAV_LABELS.inviteMember} />
      <PendingButton icon={FolderPlus} label={NAV_LABELS.newProject} />
      <Button size="sm" onClick={() => openNewTask()}>
        <Plus aria-hidden strokeWidth={1.8} />
        {NAV_LABELS.newTask}
      </Button>
    </>
  );
}

type Tone = "muted" | "green" | "red";
const TONE: Record<Tone, string> = {
  muted: "text-(--text-3)",
  green: "text-(--green)",
  red: "text-(--red)",
};

function Stat({ label, value, note, tone, delay }: { label: string; value: number; note: string; tone: Tone; delay: number }) {
  return (
    <div
      className="min-w-0 animate-[riseIn_.32s_var(--ease)_both] rounded-(--r-lg) bg-(--surface) px-(--s-4) py-(--s-3) shadow-(--shadow-card)"
      style={{ animationDelay: `${delay}ms` }}
    >
      <dt className="truncate text-(length:--fs-sm) text-(--text-3)">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <CountUp value={value} className="text-(length:--fs-2xl) leading-tight font-semibold text-(--text)" />
        <span className={cn("truncate text-(length:--fs-xs) font-medium", TONE[tone])}>{note}</span>
      </dd>
    </div>
  );
}

export function HomeView({
  projects,
  activities,
  nowIso,
}: {
  projects: HomeProject[];
  activities: HomeActivity[];
  nowIso: string;
}) {
  const { items, meId } = useTasks();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const s = useMemo(() => homeStats(items, projects, meId, now), [items, projects, meId, now]);

  return (
    <div className="px-(--gutter) pb-(--s-8)">
      <h2 className="sr-only">요약</h2>
      <dl className="grid grid-cols-4 gap-(--s-3) max-[900px]:grid-cols-2">
        <Stat
          label={HOME_STAT_LABELS.activeProjects}
          value={s.activeProjects}
          note={HOME_STAT_NOTES.risk(s.riskProjects)}
          tone={s.riskProjects > 0 ? "red" : "muted"}
          delay={0}
        />
        <Stat
          label={HOME_STAT_LABELS.openTasks}
          value={s.openTasks}
          note={HOME_STAT_NOTES.mine(s.myOpenTasks)}
          tone="muted"
          delay={40}
        />
        <Stat
          label={HOME_STAT_LABELS.completed}
          value={s.doneThisWeek}
          note={HOME_STAT_NOTES.thisWeek}
          tone="green"
          delay={80}
        />
        <Stat
          label={HOME_STAT_LABELS.overdue}
          value={s.overdue}
          note={s.overdue > 0 ? HOME_STAT_NOTES.needAttention : HOME_STAT_NOTES.allOnTrack}
          tone={s.overdue > 0 ? "red" : "green"}
          delay={120}
        />
      </dl>

      <div className="mt-(--s-4) grid grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start gap-(--s-4) max-[1100px]:grid-cols-1">
        <div className="grid min-w-0 gap-(--s-4)">
          <MyTasksPanel now={now} />
          <ProjectProgressPanel projects={projects} now={now} />
        </div>
        <div className="grid min-w-0 gap-(--s-4)">
          <DeadlinesPanel now={now} />
          <ActivityPanel activities={activities} now={now} />
        </div>
      </div>
      <TaskDrawerHost />
    </div>
  );
}
