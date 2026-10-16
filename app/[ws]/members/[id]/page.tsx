// 구성원 프로필. 사용자 id로 이 워크스페이스의 구성원을 찾고(없으면 404) 프로필·stat·담당 작업·최근 활동을 보인다
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { CountUp } from "@/components/home/parts";
import { MemberProfileBody } from "@/components/org/member-profile";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { selectActivities } from "@/lib/activity/queries";
import { getMember, getWorkspace } from "@/lib/data/workspace";
import { getLocale, getT } from "@/lib/i18n/server";
import { orgErrorMessage } from "@/lib/org/errors";
import { canOpenOrg, getMemberTasks, getOrgMembers, getTeams } from "@/lib/org/queries";
import { createClient } from "@/lib/supabase/server";
import { dueBucket } from "@/lib/tasks/view";

type Params = Promise<{ ws: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ws, id } = await params;
  // 403 응답의 제목에 구성원 이름이 실리지 않게 역할부터 보고 목록과 같은 제목만 준다
  const t = await getT();
  if (!(await canOpenOrg(ws))) return { title: t("common.nav.members") };
  const member = await getMember(ws, id);
  return member ? { title: member.profiles?.name || t("org.memberProfile.fallbackTitle") } : {};
}

const ACTIVITY_LIMIT = 10;

// tz는 본인이 직접 update로 아무 문자열이나 넣을 수 있어 모르는 시간대면 시각을 뺀다(null)
function timeIn(tz: string, now: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  } catch {
    return null;
  }
}

export default async function MemberPage({ params }: { params: Params }) {
  const { ws, id } = await params;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const [workspace, found] = await Promise.all([getWorkspace(ws), getMember(ws, id)]);
  // 워크스페이스 404 → 역할 403 → 구성원 404 순서로 본다. 게스트에게 사용자 id의 존재를 드러내지 않는다
  if (!workspace) notFound();
  if (!(await canOpenOrg(ws))) forbidden();
  if (!found) notFound();

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
  const open = tasks.filter((task) => task.status !== "done");
  const stats = [
    { label: t("org.memberProfile.stat.open"), value: open.length },
    { label: t("org.memberProfile.stat.done"), value: tasks.length - open.length },
    {
      label: t("org.memberProfile.stat.overdue"),
      value: open.filter((task) => task.due_date && dueBucket(task.due_date, now) === "overdue").length,
    },
    { label: t("org.memberProfile.stat.projects"), value: new Set(tasks.map((task) => task.project.id)).size },
  ];
  const team = teams.find((x) => x.id === member.teamId);
  const localTime = timeIn(member.tz, now, locale) ?? t("org.memberProfile.unknownTime");
  const facts = [
    [t("org.memberProfile.fact.role"), t(`common.role.${member.role}`)],
    [t("org.memberProfile.fact.status"), t(`common.memberStatus.${member.status}`)],
    [t("org.memberProfile.fact.team"), team?.name ?? "—"],
    [t("org.memberProfile.fact.email"), member.email || "—"],
    [t("org.memberProfile.fact.tz"), t("org.memberProfile.tzValue", { tz: member.tz, time: localTime })],
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
            {[member.title, t(`common.role.${member.role}`)].filter(Boolean).join(" · ")}
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
