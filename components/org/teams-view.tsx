"use client";
// 팀 목록 화면 본문. 팀 카드(구성원·프로젝트 수)와 관리자용 새 팀 버튼. ?new=1이면 새 팀 대화상자를 연 채 연다
import { Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OrgTabs } from "@/components/org/org-tabs";
import { TeamDialog } from "@/components/org/team-dialog";
import { EmptyState } from "@/components/shell/empty-state";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectIcon } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import { NAV_LABELS } from "@/lib/i18n/labels";
import type { OrgMember, OrgTeam, TeamProject } from "@/lib/org/queries";

const MAX_AVATARS = 5;

export function TeamsView({
  workspace,
  teams,
  members,
  projects,
  admin,
  openNew,
}: {
  workspace: { id: string; slug: string };
  teams: OrgTeam[];
  members: OrgMember[];
  projects: TeamProject[];
  admin: boolean;
  openNew: boolean;
}) {
  const [open, setOpen] = useState(openNew && admin);
  const [dialogKey, setDialogKey] = useState(0);
  const openDialog = () => {
    setDialogKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title={NAV_LABELS.teams}
        subtitle="구성원과 프로젝트를 팀으로 묶어 봅니다."
        actions={
          admin && (
            <Button size="sm" onClick={openDialog}>
              <Plus aria-hidden strokeWidth={1.8} />
              {NAV_LABELS.newTeam}
            </Button>
          )
        }
      />
      <OrgTabs wsSlug={workspace.slug} />
      <TeamDialog key={dialogKey} workspace={workspace} open={open} onOpenChange={setOpen} />

      {teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="아직 팀이 없습니다"
          description={admin ? "팀을 만들어 구성원과 프로젝트를 묶어 보세요." : "관리자가 팀을 만들면 여기에 보입니다."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 px-(--gutter) pb-(--s-8) sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => {
            const people = members.filter((m) => m.teamId === t.id && m.status !== "deactivated");
            const count = projects.filter((p) => p.teamId === t.id).length;
            return (
              <li key={t.id}>
                <Link
                  href={`/${workspace.slug}/teams/${t.id}`}
                  className="flex h-full flex-col gap-3 rounded-(--r-lg) bg-(--surface) p-(--s-4) shadow-(--shadow-card) outline-none transition-colors duration-(--dur) hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectIcon icon={t.icon} color={t.color} size={28} />
                    <span className="truncate text-(length:--fs-md) font-semibold text-(--text)">{t.name}</span>
                  </span>
                  {t.description && (
                    <span className="line-clamp-2 text-(length:--fs-sm) text-(--text-3)">{t.description}</span>
                  )}
                  <span className="mt-auto flex items-center justify-between gap-2 text-(length:--fs-sm) text-(--text-3)">
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        {people.slice(0, MAX_AVATARS).map((m) => (
                          <MemberAvatar key={m.id} name={m.name} color={m.color} size={22} className="ring-2 ring-(--surface)" />
                        ))}
                      </span>
                      <span>구성원 {people.length}명</span>
                    </span>
                    <span>프로젝트 {count}개</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
