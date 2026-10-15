"use client";
// 팀 상세 본문. 팀 정보·편집·삭제(관리자), 구성원 배정·해제, 팀 프로젝트와 열린 작업 수를 그린다
import { MoreHorizontal, Pencil, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { TeamDialog } from "@/components/org/team-dialog";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { announce } from "@/components/tasks/views/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/i18n/labels";
import { deleteTeam, setMemberTeam } from "@/lib/org/actions";
import type { OrgMember, OrgTeam, TeamProject } from "@/lib/org/queries";

type Props = {
  workspace: { id: string; slug: string };
  team: OrgTeam;
  members: OrgMember[];
  projects: TeamProject[];
  openTasks: number;
  admin: boolean;
};

const sectionTitle = "mb-(--s-3) text-(length:--fs-md) font-semibold text-(--text)";

export function TeamDetail({ workspace, team, members, projects, openTasks, admin }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const inTeam = members.filter((m) => m.teamId === team.id && m.status !== "deactivated");
  // 다른 팀 소속이면 옮겨진다는 점을 선택지에 함께 보인다
  const candidates = members.filter((m) => m.teamId !== team.id && m.status !== "deactivated");

  const assign = async (m: OrgMember, teamId: string | null) => {
    if (busy) return;
    setBusy(true);
    const r = await setMemberTeam(workspace.id, m.id, teamId);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    const msg = teamId ? `${m.name}을(를) ${team.name} 팀에 넣었습니다.` : `${m.name}을(를) 팀에서 뺐습니다.`;
    toast.success(msg);
    announce(msg);
  };

  const stats = [
    ["구성원", inTeam.length],
    ["프로젝트", projects.length],
    ["구성원 열린 작업", openTasks],
  ] as const;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 px-(--gutter) pt-(--s-6) pb-(--s-4)">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectIcon icon={team.icon} color={team.color} size={40} />
          <div className="min-w-0">
            <h1 className="truncate text-(length:--fs-2xl) leading-tight font-semibold tracking-tight text-(--text)">
              {team.name}
            </h1>
            {team.description && <p className="mt-1 text-(length:--fs-base) text-(--text-3)">{team.description}</p>}
          </div>
        </div>
        {admin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="팀 메뉴">
                <MoreHorizontal aria-hidden strokeWidth={1.8} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEditKey((k) => k + 1);
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden strokeWidth={1.8} />
                팀 편집
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 aria-hidden strokeWidth={1.8} />
                팀 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <ul className="grid grid-cols-3 gap-3 px-(--gutter) pb-(--s-6)">
        {stats.map(([label, value]) => (
          <li key={label} className="rounded-(--r-lg) bg-(--surface) p-(--s-4) shadow-(--shadow-card)">
            <p className="text-(length:--fs-sm) text-(--text-3)">{label}</p>
            <p className="mt-1 text-(length:--fs-xl) font-semibold text-(--text) tabular-nums">{value}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-(--s-8) px-(--gutter) pb-(--s-8) lg:grid-cols-2">
        <section aria-labelledby="team-members-title" className="min-w-0">
          <h2 id="team-members-title" className={sectionTitle}>
            구성원
          </h2>
          {admin && candidates.length > 0 && (
            <Select
              value=""
              onValueChange={(id) => {
                const m = candidates.find((c) => c.id === id);
                if (m) void assign(m, team.id);
              }}
            >
              <SelectTrigger aria-label="팀에 구성원 추가" className="mb-(--s-3) w-full sm:w-64" disabled={busy}>
                <SelectValue placeholder="구성원 추가" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.teamId && <span className="text-(--text-3)"> · 다른 팀에서 옮김</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {inTeam.length === 0 ? (
            <p className="text-(length:--fs-sm) text-(--text-3)">아직 팀 구성원이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-(--divider) rounded-(--r) border border-(--border)">
              {inTeam.map((m) => (
                <li key={m.id} className="flex h-(--row-h) items-center gap-2 px-(--s-3)">
                  <MemberAvatar name={m.name} color={m.color} size={22} />
                  <Link
                    href={`/${workspace.slug}/members/${m.id}`}
                    className="min-w-0 flex-1 truncate rounded-(--r-xs) text-(--text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--accent)"
                  >
                    {m.name}
                  </Link>
                  <span className="text-(length:--fs-sm) text-(--text-3)">{ROLE_LABELS[m.role]}</span>
                  {admin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${m.name} 팀에서 빼기`}
                      disabled={busy}
                      onClick={() => assign(m, null)}
                    >
                      <UserMinus aria-hidden strokeWidth={1.8} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="team-projects-title" className="min-w-0">
          <h2 id="team-projects-title" className={sectionTitle}>
            프로젝트
          </h2>
          {projects.length === 0 ? (
            <p className="text-(length:--fs-sm) text-(--text-3)">이 팀에 연결된 프로젝트가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-(--divider) rounded-(--r) border border-(--border)">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${workspace.slug}/projects/${p.key}/overview`}
                    className="flex h-(--row-h) items-center gap-2 px-(--s-3) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
                  >
                    <ProjectIcon icon={p.icon} color={p.color} size={20} />
                    <span className="min-w-0 flex-1 truncate text-(--text)">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-(length:--fs-sm) text-(--text-3)">
                      {/* 옆 글자가 상태를 읽어 주므로 점의 접근성 이름은 숨긴다 */}
                      <span aria-hidden className="inline-flex">
                        <ProjectStatusDot status={p.status} />
                      </span>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {admin && (
        <>
          <TeamDialog key={editKey} workspace={workspace} team={team} open={editing} onOpenChange={setEditing} />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title="팀 삭제"
            description={`${team.name} 팀을 삭제합니다. 구성원과 프로젝트는 지워지지 않고 팀 연결만 해제됩니다. 되돌릴 수 없습니다.`}
            confirmLabel="삭제"
            onConfirm={async () => {
              const r = await deleteTeam(team.id);
              if (!r.ok) return r.error;
              toast.success("팀을 삭제했습니다.");
              router.push(`/${workspace.slug}/teams`);
              return null;
            }}
          />
        </>
      )}
    </>
  );
}
