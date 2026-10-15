// 구성원 프로필. 사용자 id로 이 워크스페이스의 구성원을 찾고(없으면 404) 프로필·stat·담당 작업·최근 활동을 보인다
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountUp } from "@/components/home/parts";
import { MemberProfileBody } from "@/components/org/member-profile";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { selectActivities } from "@/lib/activity/queries";
import { getMember, getWorkspace } from "@/lib/data/workspace";
import { MEMBER_STATUS_LABELS, ROLE_LABELS } from "@/lib/i18n/labels";
import { orgErrorMessage } from "@/lib/org/errors";
import { getMemberTasks, getOrgMembers, getTeams } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { dueBucket } from "@/lib/tasks/view";

type Params = Promise<{ ws: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, id } = await params;
  const member = await getMember(ws, id);
  return member ? { title: member.profiles?.name || "구성원" } : {};
}

const ACTIVITY_LIMIT = 10;

// tz는 본인이 직접 update로 아무 문자열이나 넣을 수 있어 모르는 시간대면 시각을 뺀다
function timeIn(tz: string, now: Date) {
  try {
    return new Intl.DateTimeFormat("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  } catch {
    return "알 수 없음";
  }
}

export default async function MemberPage({ params }: { params: Params }) {
  const { ws, id } = await params;
  const [workspace, found] = await Promise.all([getWorkspace(ws), getMember(ws, id)]);
  if (!workspace || !found) notFound();

  const supabase = await createClient();
  const [members, teams, tasks, activity] = await Promise.all([
    getOrgMembers(workspace.id),
    getTeams(workspace.id),
    getMemberTasks(workspace.id, id),
    selectActivities(supabase, { workspaceId: workspace.id }, { actorId: id }, null),
  ]);
  if (activity.error) {
    console.error("[구성원 활동]", activity.error.code, activity.error.message);
    throw new Error(`활동을 불러오지 못했습니다. ${orgErrorMessage(activity.error)}`);
  }
  const member = members.find((m) => m.id === id);
  if (!member) notFound();

  const now = new Date();
  const open = tasks.filter((t) => t.status !== "done");
  const stats = [
    { label: "열린 작업", value: open.length },
    { label: "완료", value: tasks.length - open.length },
    { label: "기한 지남", value: open.filter((t) => t.due_date && dueBucket(t.due_date, now) === "overdue").length },
    { label: "참여 프로젝트", value: new Set(tasks.map((t) => t.project.id)).size },
  ];
  const team = teams.find((t) => t.id === member.teamId);
  const localTime = timeIn(member.tz, now);
  const facts = [
    ["역할", ROLE_LABELS[member.role]],
    ["상태", MEMBER_STATUS_LABELS[member.status]],
    ["팀", team?.name ?? "—"],
    ["이메일", member.email || "—"],
    ["시간대", `${member.tz} · 현지 ${localTime}`],
  ] as const;

  return (
    <>
      <header className="flex flex-wrap items-center gap-4 px-(--gutter) pt-(--s-6) pb-(--s-4)">
        <MemberAvatar name={member.name} color={member.color} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-(length:--fs-2xl) leading-tight font-semibold tracking-tight text-(--text)">
            {member.name}
          </h1>
          <p className="mt-1 text-(length:--fs-base) text-(--text-3)">
            {[member.title, ROLE_LABELS[member.role]].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-(--gutter) pb-(--s-6) text-(length:--fs-sm) sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="flex min-w-0 gap-2">
            <dt className="w-14 shrink-0 text-(--text-3)">{k}</dt>
            <dd className="min-w-0 truncate text-(--text)">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="grid grid-cols-2 gap-3 px-(--gutter) pb-(--s-6) lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="rounded-(--r-lg) bg-(--surface) p-(--s-4) shadow-(--shadow-card)">
            <p className="text-(length:--fs-sm) text-(--text-3)">{s.label}</p>
            <CountUp value={s.value} className="mt-1 block text-(length:--fs-2xl) font-semibold text-(--text)" />
          </li>
        ))}
      </ul>

      <MemberProfileBody
        wsSlug={workspace.slug}
        tasks={tasks}
        activities={activity.data.items.slice(0, ACTIVITY_LIMIT)}
        members={members.map(({ id, name, color }) => ({ id, name, color }))}
        now={now.toISOString()}
      />
    </>
  );
}
