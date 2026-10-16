"use client";
// 워크스페이스 개요 본문. stat 4칸, 포트폴리오 표, 상태별 작업 막대, 담당자별 부하, 다가오는 마일스톤
import { Diamond } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CountUp, Panel } from "@/components/home/parts";
import { LINK_CLS, ProgressBar } from "@/components/projects/parts";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { DueLabel, StatusIcon } from "@/components/tasks/parts";
import { useT } from "@/lib/i18n/client";
import { TASK_STATUSES, taskStats, workload } from "@/lib/projects/stats";
import type { ProjectSummary } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; color: string; status: string };
type UpcomingMilestone = { id: string; name: string; date: string; project: { name: string; color: string } };

const WORKLOAD_MAX = 8;

function Stat({ label, value, note, delay, suffix }: { label: string; value: number; note: string; delay: number; suffix?: string }) {
  return (
    <div
      className="min-w-0 animate-[riseIn_.32s_var(--ease)_both] rounded-(--r-lg) bg-(--surface) px-(--s-4) py-(--s-3) shadow-(--shadow-card)"
      style={{ animationDelay: `${delay}ms` }}
    >
      <dt className="truncate text-(length:--fs-sm) text-(--text-3)">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-(length:--fs-2xl) leading-tight font-semibold text-(--text)">
          <CountUp value={value} />
          {suffix}
        </span>
        <span className="truncate text-(length:--fs-xs) font-medium text-(--text-3)">{note}</span>
      </dd>
    </div>
  );
}

export function WorkspaceOverview({
  projects,
  members,
  milestones,
  wsSlug,
  nowIso,
}: {
  projects: ProjectSummary[];
  members: Member[];
  milestones: UpcomingMilestone[];
  wsSlug: string;
  nowIso: string;
}) {
  const t = useT();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tasks = useMemo(() => projects.flatMap((p) => p.tasks), [projects]);
  const all = useMemo(() => taskStats(tasks, now), [tasks, now]);
  const load = useMemo(() => workload(tasks).slice(0, WORKLOAD_MAX), [tasks]);
  const active = projects.filter((p) => p.status === "active" || p.status === "risk").length;
  const activeMembers = members.filter((m) => m.status === "active").length;
  const invited = members.filter((m) => m.status === "invited").length;
  const maxLoad = load[0]?.open ?? 0;

  return (
    <div className="px-(--gutter) pb-(--s-8)">
      <h2 className="sr-only">{t("projects.overview.summary")}</h2>
      <dl className="grid grid-cols-4 gap-(--s-3) max-[901px]:grid-cols-2">
        <Stat label={t("common.overviewStat.projects")} value={projects.length} note={t("projects.overview.activeCount", { count: active })} delay={0} />
        <Stat label={t("common.overviewStat.tasks")} value={all.total} note={t("projects.overview.openCount", { count: all.open })} delay={40} />
        <Stat label={t("common.overviewStat.completion")} value={all.pct} suffix="%" note={t("projects.overview.doneCount", { count: all.done })} delay={80} />
        <Stat
          label={t("common.overviewStat.members")}
          value={activeMembers}
          note={invited > 0 ? t("projects.overview.invitedCount", { count: invited }) : t("projects.overview.allActive")}
          delay={120}
        />
      </dl>

      <div className="mt-(--s-4) grid grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start gap-(--s-4) max-[1100px]:grid-cols-1">
        <Panel title={t("projects.overview.portfolio")} titleId="ov-portfolio" delay={160}>
          {projects.length === 0 ? (
            <p className="px-(--s-4) py-(--s-6) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.list.emptyTitle")}</p>
          ) : (
            <table className="w-full table-fixed text-(length:--fs-sm)">
              <thead>
                <tr className="h-9 border-b border-(--divider) text-left text-(length:--fs-xs) text-(--text-3)">
                  <th scope="col" className="px-(--s-4) font-medium">
                    {t("common.projectColumn.project")}
                  </th>
                  <th scope="col" className="hide-m w-28 font-medium max-[1100px]:hidden">
                    {t("common.projectColumn.lead")}
                  </th>
                  <th scope="col" className="hide-m w-20 font-medium">
                    {t("common.projectColumn.status")}
                  </th>
                  <th scope="col" className="w-32 font-medium max-[640px]:w-24">
                    {t("common.projectColumn.progress")}
                  </th>
                  <th scope="col" className="w-12 text-right font-medium">
                    <abbr title={t("common.projectColumn.open")} className="no-underline">
                      {t("projects.overview.openShort")}
                    </abbr>
                  </th>
                  <th scope="col" className="w-12 text-right font-medium">
                    <abbr title={t("common.projectColumn.overdue")} className="no-underline">
                      {t("projects.overview.overdueShort")}
                    </abbr>
                  </th>
                  <th scope="col" className="hide-m w-20 pr-(--s-4) pl-(--s-3) font-medium">
                    {t("common.projectColumn.due")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const lead = p.leadId ? byId.get(p.leadId) : undefined;
                  return (
                    <tr key={p.id} className="h-11 border-b border-(--divider) last:border-b-0 hover:bg-(--surface-2)">
                      <td className="px-(--s-4)">
                        <Link
                          href={`/${wsSlug}/projects/${encodeURIComponent(p.key)}/overview`}
                          className={cn(LINK_CLS, "flex min-w-0 items-center gap-2 font-medium text-(--text)")}
                        >
                          <ProjectIcon icon={p.icon} color={p.color} size={20} />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </td>
                      <td className="hide-m max-[1100px]:hidden">
                        <span className="block truncate text-(--text-2)">{lead?.name ?? t("common.noLead")}</span>
                      </td>
                      <td className="hide-m">
                        <span className="inline-flex items-center gap-1.5 text-(--text-2)">
                          <ProjectStatusDot status={p.status} />
                          <span aria-hidden className="truncate">
                            {t(`common.projectStatus.${p.status}`)}
                          </span>
                        </span>
                      </td>
                      <td>
                        <ProgressBar pct={p.stats.pct} label={t("projects.progressOf", { name: p.name })} className="pr-(--s-2)" />
                      </td>
                      <td className="text-right tabular-nums text-(--text-2)">{p.stats.open}</td>
                      <td className={cn("text-right tabular-nums", p.stats.overdue > 0 ? "text-(--red)" : "text-(--text-3)")}>
                        {p.stats.overdue}
                      </td>
                      <td className="hide-m pr-(--s-4) pl-(--s-3)">
                        <DueLabel due={p.dueDate} done={p.status === "complete"} now={now} placeholder="—" className="text-(length:--fs-xs)" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="grid min-w-0 gap-(--s-4)">
          <Panel title={t("projects.overview.byStatus")} titleId="ov-status" delay={200}>
            <div className="flex flex-col gap-(--s-3) px-(--s-4) py-(--s-3)">
              {all.total === 0 ? (
                <p className="text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.overview.noTasks")}</p>
              ) : (
                <div role="img" aria-label={TASK_STATUSES.map((s) => t("projects.statusCount", { status: t(`common.taskStatus.${s}`), count: all.byStatus[s] })).join(", ")} className="flex h-2.5 overflow-hidden rounded-(--r-full) bg-(--surface-3)">
                  {TASK_STATUSES.map((s) =>
                    all.byStatus[s] > 0 ? (
                      <span
                        key={s}
                        className="h-full origin-left animate-[growX_.52s_var(--ease)_both]"
                        style={{ width: `${(all.byStatus[s] / all.total) * 100}%`, background: `var(--st-${s})` }}
                      />
                    ) : null,
                  )}
                </div>
              )}
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {TASK_STATUSES.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-(length:--fs-sm) text-(--text-2)">
                    <StatusIcon status={s} size={12} />
                    <span aria-hidden className="truncate">
                      {t(`common.taskStatus.${s}`)}
                    </span>
                    <span className="ml-auto tabular-nums text-(--text)">{all.byStatus[s]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title={t("projects.overview.workload")} titleId="ov-workload" delay={240}>
            {load.length === 0 ? (
              <p className="px-(--s-4) py-(--s-5) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.overview.noWorkload")}</p>
            ) : (
              <ul className="flex flex-col gap-2 px-(--s-4) py-(--s-3)">
                {load.map((w) => {
                  const m = byId.get(w.userId);
                  const name = m?.name ?? t("common.unknownUser");
                  return (
                    <li key={w.userId} className="flex items-center gap-2 text-(length:--fs-sm)">
                      <MemberAvatar name={name} color={m?.color} size={20} />
                      <span className="w-24 shrink-0 truncate text-(--text-2)">{name}</span>
                      <span aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-(--r-full) bg-(--surface-3)">
                        <span
                          className="block h-full origin-left animate-[growX_.52s_var(--ease)_both] rounded-(--r-full) bg-(--accent)"
                          style={{ width: `${maxLoad ? (w.open / maxLoad) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right text-(length:--fs-xs) text-(--text-3) tabular-nums">{t("projects.overview.openLoad", { count: w.open })}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t("projects.overview.upcomingMilestones")} titleId="ov-milestones" delay={280}>
            {milestones.length === 0 ? (
              <p className="px-(--s-4) py-(--s-5) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.overview.noMilestones")}</p>
            ) : (
              <ul>
                {milestones.map((m) => (
                  <li key={m.id} className="flex h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--s-4) last:border-b-0">
                    <Diamond size={12} strokeWidth={1.8} aria-hidden className="shrink-0" style={{ color: `var(--accent)` }} />
                    <span className="min-w-0 flex-1 truncate text-(length:--fs-sm) text-(--text)">{m.name}</span>
                    <span className="hide-m max-w-28 truncate text-(length:--fs-xs) text-(--text-3)">{m.project.name}</span>
                    <DueLabel due={m.date} now={now} className="w-16 shrink-0 text-right text-(length:--fs-xs)" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
