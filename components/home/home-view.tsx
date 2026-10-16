"use client";
// 홈 화면 본문. 머리말 버튼, stat 4칸, 내 작업·프로젝트 진행(왼쪽)과 다가오는 마감·최근 활동(오른쪽) 패널을 그린다.
// 숫자는 store 작업에서 계산하므로 완료 토글이 바로 반영된다
import { FolderPlus, Plus, UserPlus } from "lucide-react";
import { useMemo } from "react";
import { ActivityPanel, DeadlinesPanel, MyTasksPanel, ProjectProgressPanel } from "@/components/home/home-panels";
import { CountUp } from "@/components/home/parts";
import { InviteDialog } from "@/components/org/invite-dialog";
import { useNewProject } from "@/components/projects/new-project-launcher";
import { Button } from "@/components/ui/button";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useNewTask } from "@/components/tasks/new-task";
import { useTasks } from "@/components/tasks/task-store";
import { useT } from "@/lib/i18n/client";
import type { HomeActivity, HomeProject } from "@/lib/home/queries";
import { homeStats } from "@/lib/home/stats";
import { cn } from "@/lib/utils";

// 머리말 오른쪽 버튼. 구성원 초대는 owner·admin만 할 수 있어(RLS) 그 역할에게만 보인다
export function HomeActions() {
  const t = useT();
  const { openNewTask } = useNewTask();
  const { openNewProject } = useNewProject();
  const { members, meId, workspace } = useTasks();
  const role = members.find((m) => m.id === meId)?.role;
  return (
    <>
      {(role === "owner" || role === "admin") && (
        <InviteDialog
          workspaceId={workspace.id}
          trigger={
            <Button variant="outline" size="sm" aria-label={t("common.nav.inviteMember")}>
              <UserPlus aria-hidden strokeWidth={1.8} />
              <span className="hide-m">{t("common.nav.inviteMember")}</span>
            </Button>
          }
        />
      )}
      {/* 게스트는 create_project가 거부하므로 새 프로젝트 버튼을 보이지 않는다 */}
      {role !== "guest" && (
        <Button variant="outline" size="sm" aria-label={t("common.nav.newProject")} onClick={openNewProject}>
          <FolderPlus aria-hidden strokeWidth={1.8} />
          <span className="hide-m">{t("common.nav.newProject")}</span>
        </Button>
      )}
      <Button size="sm" onClick={() => openNewTask()}>
        <Plus aria-hidden strokeWidth={1.8} />
        {t("common.nav.newTask")}
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
  const t = useT();
  const { items, meId } = useTasks();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const s = useMemo(() => homeStats(items, projects, meId, now), [items, projects, meId, now]);

  return (
    <div className="px-(--gutter) pb-(--s-8)">
      <h2 className="sr-only">{t("home.summary")}</h2>
      <dl className="grid grid-cols-4 gap-(--s-3) max-[901px]:grid-cols-2">
        <Stat
          label={t("common.homeStat.activeProjects")}
          value={s.activeProjects}
          note={t("common.homeStatNote.risk", { n: s.riskProjects })}
          tone={s.riskProjects > 0 ? "red" : "muted"}
          delay={0}
        />
        <Stat
          label={t("common.homeStat.openTasks")}
          value={s.openTasks}
          note={t("common.homeStatNote.mine", { n: s.myOpenTasks })}
          tone="muted"
          delay={40}
        />
        <Stat
          label={t("common.homeStat.completed")}
          value={s.doneThisWeek}
          note={t("common.homeStatNote.thisWeek")}
          tone="green"
          delay={80}
        />
        <Stat
          label={t("common.homeStat.overdue")}
          value={s.overdue}
          note={s.overdue > 0 ? t("common.homeStatNote.needAttention") : t("common.homeStatNote.allOnTrack")}
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
