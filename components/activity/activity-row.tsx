"use client";
// 활동 한 줄. 행위자 아바타와 formatActivity 문장, 프로젝트·상대 시간. 작업 이름을 누르면 드로어를 열고 프로젝트 이름은 개요로 간다
import Link from "next/link";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { formatActivity } from "@/lib/activity/format";
import { formatRelative } from "@/lib/format/date";
import type { HomeActivity } from "@/lib/home/queries";
import { UNKNOWN_USER_LABEL } from "@/lib/i18n/labels";

const strongLink =
  "rounded-(--r-xs) font-semibold text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)";

type Props = {
  a: HomeActivity;
  now: Date;
  wsSlug: string;
  member: (id: string) => { name: string; color: string } | undefined;
  // 없으면 작업 이름을 굵은 글자로만 보인다(드로어 안의 활동 탭)
  onOpenTask?: (key: string) => void;
  showProject?: boolean;
};

export function ActivityRow({ a, now, wsSlug, member, onOpenTask, showProject = true }: Props) {
  const segments = formatActivity({
    verb: a.verb,
    extra: a.extra,
    actorName: a.actorName,
    taskTitle: a.task?.title ?? null,
    hasTask: a.hasTask,
    projectName: a.project.name,
    memberName: (id) => member(id)?.name,
  });
  const actor = a.actorId ? member(a.actorId) : undefined;
  const task = a.task;
  return (
    <div className="flex gap-2.5">
      <MemberAvatar name={a.actorName ?? UNKNOWN_USER_LABEL} color={actor?.color} size={24} className="mt-0.5" />
      <p className="min-w-0 flex-1 text-(length:--fs-sm) leading-relaxed break-words text-(--text-2)">
        {segments.map((s, i) =>
          !s.strong ? (
            <span key={i}>{s.text}</span>
          ) : a.hasTask && task && onOpenTask ? (
            <button key={i} type="button" onClick={() => onOpenTask(task.key)} className={strongLink}>
              {s.text}
            </button>
          ) : !a.hasTask ? (
            <Link key={i} href={`/${wsSlug}/projects/${a.project.key}/overview`} className={strongLink}>
              {s.text}
            </Link>
          ) : (
            <strong key={i} className="font-semibold text-(--text)">
              {s.text}
            </strong>
          ),
        )}
        <span className="text-(--text-3)">
          {showProject && a.hasTask && ` · ${a.project.name}`} ·{" "}
          <time dateTime={a.created_at}>{formatRelative(a.created_at, now)}</time>
        </span>
      </p>
    </div>
  );
}
