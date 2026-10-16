"use client";
// 구성원 프로필 본문. stat 4칸, 담당·완료 작업 탭, 최근 활동을 그린다. 작업은 작업 페이지로 링크한다
import { CheckCircle2, Inbox } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ActivityRow } from "@/components/activity/activity-row";
import { StatusIcon, DueLabel, TaskKey } from "@/components/tasks/parts/display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/client";
import type { HomeActivity } from "@/lib/home/queries";
import type { MemberTask, OrgMember } from "@/lib/org/queries";

type Props = {
  wsSlug: string;
  tasks: MemberTask[];
  activities: HomeActivity[];
  members: Pick<OrgMember, "id" | "name" | "color">[];
  now: string;
};

function TaskRows({ items, wsSlug, at }: { items: MemberTask[]; wsSlug: string; at: Date }) {
  return (
    <ul className="divide-y divide-(--divider) rounded-(--r) border border-(--border)">
      {items.map((task) => (
        <li key={task.id}>
          <Link
            href={`/${wsSlug}/task/${task.key}`}
            className="flex h-(--row-h) items-center gap-2 px-(--s-3) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
          >
            <StatusIcon status={task.status} />
            <TaskKey value={task.key} />
            <span className="min-w-0 flex-1 truncate text-(--text)">{task.title}</span>
            <span className="hidden truncate text-(length:--fs-sm) text-(--text-3) sm:inline">{task.project.name}</span>
            <DueLabel due={task.due_date} done={task.status === "done"} now={at} className="text-(length:--fs-sm)" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MemberProfileBody({ wsSlug, tasks, activities, members, now }: Props) {
  const t = useT();
  const at = useMemo(() => new Date(now), [now]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const open = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");

  return (
    <div className="grid gap-(--s-8) px-(--gutter) pb-(--s-8)">
      <Tabs defaultValue="assigned">
        <TabsList>
          <TabsTrigger value="assigned">
            {t("org.memberProfile.assigned")} <span className="tabular-nums text-(--text-3)">{open.length}</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t("org.memberProfile.completed")} <span className="tabular-nums text-(--text-3)">{done.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assigned" className="mt-(--s-3)">
          {open.length ? (
            <TaskRows items={open} wsSlug={wsSlug} at={at} />
          ) : (
            <p className="flex items-center gap-2 text-(length:--fs-sm) text-(--text-3)">
              <Inbox aria-hidden size={14} strokeWidth={1.8} />
              {t("org.memberProfile.noAssigned")}
            </p>
          )}
        </TabsContent>
        <TabsContent value="completed" className="mt-(--s-3)">
          {done.length ? (
            <TaskRows items={done} wsSlug={wsSlug} at={at} />
          ) : (
            <p className="flex items-center gap-2 text-(length:--fs-sm) text-(--text-3)">
              <CheckCircle2 aria-hidden size={14} strokeWidth={1.8} />
              {t("org.memberProfile.noCompleted")}
            </p>
          )}
        </TabsContent>
      </Tabs>

      <section aria-labelledby="member-activity-title">
        <h2 id="member-activity-title" className="mb-(--s-3) text-(length:--fs-md) font-semibold text-(--text)">
          {t("org.memberProfile.recentActivity")}
        </h2>
        {activities.length ? (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id}>
                <ActivityRow a={a} now={at} wsSlug={wsSlug} member={(id) => byId.get(id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-(length:--fs-sm) text-(--text-3)">{t("org.memberProfile.noActivity")}</p>
        )}
      </section>
    </div>
  );
}
