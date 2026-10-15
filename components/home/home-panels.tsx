"use client";
// 홈 패널 네 개. 내 작업(탭), 프로젝트 진행 표, 다가오는 마감, 최근 활동
import Link from "next/link";
import { useMemo, useState } from "react";
import { CompleteToggle, Panel, ProjectDot } from "@/components/home/parts";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssigneeAvatar, DueLabel, PriorityIcon } from "@/components/tasks/parts";
import { useTasks } from "@/components/tasks/task-store";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { formatActivity } from "@/lib/activity/format";
import { formatDue, formatRelative } from "@/lib/format/date";
import type { HomeActivity, HomeProject } from "@/lib/home/queries";
import { deadlineGroups, myTaskTabs, projectProgress } from "@/lib/home/stats";
import {
  DEADLINE_GROUP_LABELS,
  MY_TASK_BUCKET_LABELS,
  PROJECT_PROGRESS_COLUMN_LABELS,
  PROJECT_STATUS_LABELS,
  UNKNOWN_USER_LABEL,
} from "@/lib/i18n/labels";
import type { TaskItem } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const MY_TASKS_MAX = 7;
const DEADLINE_MAX = 3;
const TEAM_MAX = 3;

const titleBtn =
  "min-w-0 flex-1 truncate rounded-(--r-xs) text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)";

// ─────────────────────────────────────────────
// 내 작업
// ─────────────────────────────────────────────

const TABS = [
  { key: "upcoming", label: MY_TASK_BUCKET_LABELS.upcoming, empty: "예정된 작업이 없습니다" },
  { key: "overdue", label: MY_TASK_BUCKET_LABELS.overdue, empty: "기한이 지난 작업이 없습니다" },
  { key: "done", label: MY_TASK_BUCKET_LABELS.done, empty: "완료한 작업이 없습니다" },
] as const;

function MyTaskRow({ t, now }: { t: TaskItem; now: Date }) {
  const { open } = useTaskDrawer();
  const done = t.status === "done";
  return (
    <li className="flex h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--s-3) last:border-b-0 hover:bg-(--surface-2)">
      <CompleteToggle task={t} />
      <ProjectDot color={t.project.color} />
      <span className="sr-only">{t.project.name}</span>
      <button
        type="button"
        onClick={() => open(t.key)}
        className={cn(titleBtn, "text-(--text)", done && "text-(--text-3) line-through")}
      >
        {t.title}
      </button>
      <PriorityIcon priority={t.priority} size={14} />
      <DueLabel
        due={t.due_date}
        done={done}
        now={now}
        className="w-16 shrink-0 text-right text-(length:--fs-sm)"
        placeholder={<span className="sr-only">기한 없음</span>}
      />
    </li>
  );
}

export function MyTasksPanel({ now }: { now: Date }) {
  const { items, meId, workspace } = useTasks();
  const tabs = useMemo(() => myTaskTabs(items, meId, now), [items, meId, now]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");

  return (
    <Panel title="내 작업" titleId="home-my-tasks" delay={160}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-0">
        <TabsList variant="line" aria-label="내 작업 구분" className="h-10 px-(--s-2)">
          {TABS.map((x) => (
            <TabsTrigger key={x.key} value={x.key} className="flex-none px-2 text-(length:--fs-sm)">
              {x.label}
              <span className="rounded-(--r-full) bg-(--surface-3) px-1.5 text-(length:--fs-2xs) text-(--text-3) tabular-nums">
                {tabs[x.key].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((x) => {
          const list = tabs[x.key];
          return (
            <TabsContent key={x.key} value={x.key} className="border-t border-(--divider)">
              {list.length === 0 ? (
                <p className="px-(--s-4) py-(--s-6) text-center text-(length:--fs-sm) text-(--text-3)">{x.empty}</p>
              ) : (
                <>
                  <ul>
                    {list.slice(0, MY_TASKS_MAX).map((t) => (
                      <MyTaskRow key={t.id} t={t} now={now} />
                    ))}
                  </ul>
                  <div className="border-t border-(--divider) px-(--s-4) py-(--s-2)">
                    <Link
                      href={`/${workspace.slug}/my-tasks`}
                      className="rounded-(--r-xs) text-(length:--fs-sm) font-medium text-(--accent) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                    >
                      작업 {list.length}개 모두 보기
                    </Link>
                  </div>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 프로젝트 진행
// ─────────────────────────────────────────────

export function ProjectProgressPanel({ projects, now }: { projects: HomeProject[]; now: Date }) {
  const { items, members, workspace } = useTasks();
  const progress = useMemo(() => projectProgress(items), [items]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  return (
    <Panel title="프로젝트 진행" titleId="home-progress" delay={200}>
      {projects.length === 0 ? (
        <p className="px-(--s-4) py-(--s-6) text-center text-(length:--fs-sm) text-(--text-3)">아직 프로젝트가 없습니다</p>
      ) : (
        <table className="w-full table-fixed text-(length:--fs-sm)">
          <thead>
            <tr className="h-9 border-b border-(--divider) text-left text-(length:--fs-xs) text-(--text-3)">
              <th scope="col" className="px-(--s-4) font-medium">
                {PROJECT_PROGRESS_COLUMN_LABELS.project}
              </th>
              <th scope="col" className="hide-m w-24 font-medium">
                {PROJECT_PROGRESS_COLUMN_LABELS.status}
              </th>
              <th scope="col" className="w-36 font-medium max-[640px]:w-24">
                {PROJECT_PROGRESS_COLUMN_LABELS.progress}
              </th>
              <th scope="col" className="hide-m w-20 font-medium">
                {PROJECT_PROGRESS_COLUMN_LABELS.due}
              </th>
              <th scope="col" className="hide-m w-24 pr-(--s-4) font-medium">
                {PROJECT_PROGRESS_COLUMN_LABELS.team}
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const stat = progress.get(p.id);
              const pct = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
              const team = [...new Set([...p.memberIds, ...(stat?.assignees ?? [])])]
                .map((id) => byId.get(id))
                .filter((m) => m !== undefined);
              const rest = team.length - TEAM_MAX;
              return (
                <tr key={p.id} className="h-11 border-b border-(--divider) last:border-b-0 hover:bg-(--surface-2)">
                  <td className="px-(--s-4)">
                    <Link
                      href={`/${workspace.slug}/projects/${p.key}/overview`}
                      className="flex min-w-0 items-center gap-2 rounded-(--r-xs) font-medium text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                    >
                      <ProjectIcon icon={p.icon} color={p.color} size={20} />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </td>
                  <td className="hide-m">
                    <span className="inline-flex items-center gap-1.5 text-(--text-2)">
                      <ProjectStatusDot status={p.status} />
                      <span aria-hidden>{PROJECT_STATUS_LABELS[p.status]}</span>
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2 pr-(--s-3)">
                      <span
                        role="progressbar"
                        aria-label={`${p.name} 진행률`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-(--r-full) bg-(--surface-3)"
                      >
                        <span
                          className="block h-full origin-left animate-[growX_.52s_var(--ease)_both] rounded-(--r-full) bg-(--accent)"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right text-(length:--fs-xs) text-(--text-3) tabular-nums">
                        {pct}%
                      </span>
                    </span>
                  </td>
                  <td className="hide-m">
                    <DueLabel
                      due={p.due_date}
                      done={p.status === "complete"}
                      now={now}
                      placeholder="—"
                      className="text-(length:--fs-xs)"
                    />
                  </td>
                  <td className="hide-m pr-(--s-4)">
                    {team.length > 0 && (
                      <span
                        role="img"
                        aria-label={`팀 ${team.map((m) => m.name).join(", ")}`}
                        className="flex items-center"
                      >
                        {team.slice(0, TEAM_MAX).map((m) => (
                          <MemberAvatar
                            key={m.id}
                            name={m.name}
                            color={m.color}
                            size={22}
                            className="-ml-1.5 ring-2 ring-(--surface) first:ml-0"
                          />
                        ))}
                        {rest > 0 && (
                          <span className="ml-1 text-(length:--fs-2xs) text-(--text-3)" aria-hidden>
                            +{rest}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 다가오는 마감
// ─────────────────────────────────────────────

const DEADLINE_GROUPS = (["today", "tomorrow", "week"] as const).map((key) => ({
  key,
  label: DEADLINE_GROUP_LABELS[key],
}));

export function DeadlinesPanel({ now }: { now: Date }) {
  const { items } = useTasks();
  const { open } = useTaskDrawer();
  const groups = useMemo(() => deadlineGroups(items, now), [items, now]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const empty = DEADLINE_GROUPS.every((g) => groups[g.key].length === 0);

  return (
    <Panel title="다가오는 마감" titleId="home-deadlines" delay={180}>
      {empty ? (
        <p className="px-(--s-4) py-(--s-6) text-center text-(length:--fs-sm) text-(--text-3)">예정된 마감이 없습니다</p>
      ) : (
        <div className="py-(--s-1)">
          {DEADLINE_GROUPS.map((g) => {
            const list = groups[g.key];
            if (list.length === 0) return null;
            const isOpen = expanded.has(g.key);
            const shown = isOpen ? list : list.slice(0, DEADLINE_MAX);
            const listId = `home-deadline-${g.key}`;
            return (
              <section key={g.key} aria-labelledby={`${listId}-title`} className="px-(--s-2) py-(--s-1)">
                <h3
                  id={`${listId}-title`}
                  className="flex items-center gap-1.5 px-(--s-2) py-1 text-(length:--fs-xs) font-medium text-(--text-3)"
                >
                  {g.label}
                  <span className="tabular-nums">{list.length}</span>
                </h3>
                <ul id={listId}>
                  {shown.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => open(t.key)}
                        className="flex h-9 w-full items-center gap-2 rounded-(--r) px-(--s-2) text-left outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
                      >
                        <ProjectDot color={t.project.color} />
                        <span className="sr-only">{t.project.name}</span>
                        <span className="min-w-0 flex-1 truncate text-(length:--fs-sm) text-(--text)">{t.title}</span>
                        {g.key === "week" && t.due_date && (
                          <span className="shrink-0 text-(length:--fs-xs) text-(--text-3)">
                            {formatDue(t.due_date, now)}
                          </span>
                        )}
                        <AssigneeAvatar assignee={t.assignee} size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
                {list.length > DEADLINE_MAX && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.key)) next.delete(g.key);
                        else next.add(g.key);
                        return next;
                      })
                    }
                    className="ml-(--s-2) rounded-(--r-xs) px-1 text-(length:--fs-xs) font-medium text-(--accent) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                  >
                    {isOpen ? "접기" : `+${list.length - DEADLINE_MAX}개 더`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 최근 활동
// ─────────────────────────────────────────────

export function ActivityPanel({ activities, now }: { activities: HomeActivity[]; now: Date }) {
  const { members, workspace } = useTasks();
  const { open } = useTaskDrawer();
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  return (
    <Panel title="최근 활동" titleId="home-activity" delay={220}>
      {activities.length === 0 ? (
        <p className="px-(--s-4) py-(--s-6) text-center text-(length:--fs-sm) text-(--text-3)">아직 활동이 없습니다</p>
      ) : (
        <ul className="py-(--s-1)">
          {activities.map((a) => {
            const segments = formatActivity({
              verb: a.verb,
              extra: a.extra,
              actorName: a.actorName,
              taskTitle: a.task?.title ?? null,
              hasTask: a.hasTask,
              projectName: a.project.name,
              memberName: (id) => byId.get(id)?.name,
            });
            const actor = a.actorId ? byId.get(a.actorId) : undefined;
            return (
              <li key={a.id} className="flex gap-2.5 px-(--s-4) py-(--s-2)">
                <MemberAvatar
                  name={a.actorName ?? UNKNOWN_USER_LABEL}
                  color={actor?.color}
                  size={24}
                  className="mt-0.5"
                />
                <p className="min-w-0 flex-1 text-(length:--fs-sm) leading-relaxed text-(--text-2)">
                  {segments.map((s, i) =>
                    !s.strong ? (
                      <span key={i}>{s.text}</span>
                    ) : a.hasTask && a.task ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => open(a.task!.key)}
                        className="rounded-(--r-xs) font-semibold text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                      >
                        {s.text}
                      </button>
                    ) : !a.hasTask ? (
                      <Link
                        key={i}
                        href={`/${workspace.slug}/projects/${a.project.key}/overview`}
                        className="rounded-(--r-xs) font-semibold text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                      >
                        {s.text}
                      </Link>
                    ) : (
                      <strong key={i} className="font-semibold text-(--text)">
                        {s.text}
                      </strong>
                    ),
                  )}
                  <span className="text-(--text-3)">
                    {a.hasTask && ` · ${a.project.name}`} ·{" "}
                    <time dateTime={a.created_at}>{formatRelative(a.created_at, now)}</time>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
