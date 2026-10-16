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
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  const [open, setOpen] = useState(openNew && admin);
  const [dialogKey, setDialogKey] = useState(0);
  const openDialog = () => {
    setDialogKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t("common.nav.teams")}
        subtitle={t("org.teams.subtitle")}
        actions={
          admin && (
            <Button size="sm" onClick={openDialog}>
              <Plus aria-hidden strokeWidth={1.8} />
              {t("common.nav.newTeam")}
            </Button>
          )
        }
      />
      <OrgTabs wsSlug={workspace.slug} />
      <TeamDialog key={dialogKey} workspace={workspace} open={open} onOpenChange={setOpen} />

      {teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={t("org.teams.emptyTitle")}
          description={admin ? t("org.teams.emptyAdmin") : t("org.teams.emptyMember")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 px-(--gutter) pb-(--s-8) sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const people = members.filter((m) => m.teamId === team.id && m.status !== "deactivated");
            const count = projects.filter((p) => p.teamId === team.id).length;
            return (
              <li key={team.id}>
                <Link
                  href={`/${workspace.slug}/teams/${team.id}`}
                  className="flex h-full flex-col gap-3 rounded-(--r-lg) bg-(--surface) p-(--s-4) shadow-(--shadow-card) outline-none transition-colors duration-(--dur) hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectIcon icon={team.icon} color={team.color} size={28} />
                    <span className="truncate text-(length:--fs-md) font-semibold text-(--text)">{team.name}</span>
                  </span>
                  {team.description && (
                    <span className="line-clamp-2 text-(length:--fs-sm) text-(--text-3)">{team.description}</span>
                  )}
                  <span className="mt-auto flex items-center justify-between gap-2 text-(length:--fs-sm) text-(--text-3)">
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        {people.slice(0, MAX_AVATARS).map((m) => (
                          <MemberAvatar key={m.id} name={m.name} color={m.color} size={22} className="ring-2 ring-(--surface)" />
                        ))}
                      </span>
                      <span>{t("org.teams.memberCount", { count: people.length })}</span>
                    </span>
                    <span>{t("org.teams.projectCount", { count })}</span>
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
