"use client";
// 구성원 화면 본문. 검색·역할 필터, 구성원 표(역할 변경·비활성화), 초대 대화상자와 대기 중 초대 목록을 그린다.
// 고를 수 없는 역할은 화면에서 숨기지만 권한의 최종 판정은 DB가 한다
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { OrgTabs } from "@/components/org/org-tabs";
import { useInviteDialog } from "@/components/org/invite-dialog";
import { EmptyState } from "@/components/shell/empty-state";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { PageHeader } from "@/components/shell/page-header";
import { announce } from "@/components/tasks/views/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatter, useT } from "@/lib/i18n/client";
import { revokeInvite, setMemberRole, setMemberStatus } from "@/lib/org/actions";
import type { OrgMember, OrgTeam, PendingInvite } from "@/lib/org/queries";
import { assignableRoles, isAdminRole, type Role } from "@/lib/org/rules";

type Props = {
  workspace: { id: string; slug: string; name: string };
  meId: string;
  members: OrgMember[];
  // 담당 작업 기준 참여 프로젝트 수·열린 작업 수(workspace_member_stats). 없으면 0
  stats: Record<string, { projects: number; tasks: number }>;
  teams: OrgTeam[];
  invites: PendingInvite[];
  openInvite: boolean;
  // 서버 렌더 시각. 상대 시간이 hydration 때 달라지지 않게 서버와 같은 기준을 쓴다
  now: string;
};

const ROLE_FILTERS = ["all", "owner", "admin", "member", "guest"] as const;

const STATUS_TONE: Record<OrgMember["status"], string> = {
  active: "bg-(--green-soft) text-(--green)",
  invited: "bg-(--amber-soft) text-(--amber)",
  deactivated: "bg-(--surface-3) text-(--text-3)",
};

export function MembersView({ workspace, meId, members, stats, teams, invites, openInvite, now }: Props) {
  const t = useT();
  const f = useFormatter();
  const at = useMemo(() => new Date(now), [now]);
  const myRole = members.find((m) => m.id === meId)?.role ?? null;
  const admin = isAdminRole(myRole);
  const invite = useInviteDialog(workspace.id, openInvite && admin);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [confirm, setConfirm] = useState<OrgMember | null>(null);
  const teamName = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter(
      (m) =>
        (role === "all" || m.role === role) &&
        (!needle || m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle)),
    );
  }, [members, q, role]);

  const changeRole = async (m: OrgMember, next: Role) => {
    if (next === m.role) return;
    const r = await setMemberRole(workspace.id, m.id, next);
    if (!r.ok) return void toast.error(r.error);
    const msg = t("org.members.roleChanged", { name: m.name, role: t(`common.role.${next}`) });
    toast.success(msg);
    announce(msg);
  };

  const reactivate = async (m: OrgMember) => {
    const r = await setMemberStatus(workspace.id, m.id, "active");
    if (!r.ok) return void toast.error(r.error);
    const msg = t("org.members.reactivated", { name: m.name });
    toast.success(msg);
    announce(msg);
  };

  // 행 ⋯ 메뉴와 우클릭 메뉴가 같은 항목을 쓴다.
  // 비활성화·재활성화. 자기 자신과 초대됨(수락으로만 활성) 구성원, owner가 아닌 사람의 owner 행은 메뉴에 없다
  const rowActions = (
    m: OrgMember,
  ): {
    label: string;
    href?: string;
    destructive?: boolean;
    run?: () => void;
  }[] => {
    const canStatus = admin && m.id !== meId && m.status !== "invited" && (m.role !== "owner" || myRole === "owner");
    return [
      { label: t("org.members.viewProfile"), href: `/${workspace.slug}/members/${m.id}` },
      ...(canStatus && m.status === "active"
        ? [{ label: t("org.members.deactivate"), destructive: true, run: () => setConfirm(m) }]
        : []),
      ...(canStatus && m.status === "deactivated" ? [{ label: t("org.members.reactivate"), run: () => void reactivate(m) }] : []),
    ];
  };

  // 키보드로 연 우클릭 메뉴는 닫을 때 그 요소로 포커스를 돌려준다
  const keyboardOpener = useRef<HTMLElement | null>(null);
  // Shift+F10·메뉴 키로 행의 우클릭 메뉴를 연다. 포인터 좌표가 없으므로 행 왼쪽 아래에 띄운다
  const openMenuFromKeyboard = (e: React.KeyboardEvent<HTMLElement>) => {
    const row = e.currentTarget;
    // 선택 상자 목록은 포털이라 DOM으로는 행 밖이다. 그 안의 키는 받지 않는다
    if (!row.contains(e.target as Node)) return;
    if (!((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu")) return;
    e.preventDefault();
    keyboardOpener.current = e.target as HTMLElement;
    const r = row.getBoundingClientRect();
    row.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + 16,
        clientY: r.bottom - 4,
      }),
    );
  };

  const cancelInvite = async (i: PendingInvite) => {
    const r = await revokeInvite(i.id);
    if (!r.ok) return void toast.error(r.error);
    const msg = t("org.members.inviteRevoked", { email: i.email });
    toast.success(msg);
    announce(msg);
  };

  return (
    <>
      <PageHeader
        title={t("common.nav.members")}
        subtitle={t("org.members.subtitle", {
          ws: workspace.name,
          count: members.filter((m) => m.status === "active").length,
        })}
        actions={
          admin && (
            <Button size="sm" onClick={() => invite.setOpen(true)}>
              <UserPlus aria-hidden strokeWidth={1.8} />
              {t("common.nav.inviteMember")}
            </Button>
          )
        }
      />
      <OrgTabs wsSlug={workspace.slug} />
      {invite.dialog}

      <div className="flex flex-wrap items-center gap-2 px-(--gutter) pb-(--s-3)">
        <div className="relative w-full max-w-xs min-w-0 flex-1">
          <Search
            aria-hidden
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--text-3)"
          />
          <Input
            type="search"
            aria-label={t("org.members.search")}
            placeholder={t("org.members.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-(--h-md) pl-8"
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger aria-label={t("org.members.roleFilter")} className="h-(--h-md) w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? t("org.members.allRoles") : t(`common.role.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("org.members.emptyTitle")}
          description={t("org.members.emptyDescription")}
        />
      ) : (
        <div className="px-(--gutter)">
          <Table className="text-(length:--fs-base)">
            <TableHeader>
              <TableRow>
                <TableHead>{t("org.members.column.member")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("org.members.column.email")}</TableHead>
                <TableHead>{t("org.members.column.role")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("org.members.column.team")}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{t("org.members.column.projects")}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{t("org.members.column.openTasks")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("org.members.column.lastActive")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("org.members.column.status")}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{t("org.members.column.menu")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const self = m.id === meId;
                const options = assignableRoles(myRole, m.role, self);
                const actions = rowActions(m);
                const stat = stats[m.id];
                return (
                  <ContextMenu key={m.id}>
                    <ContextMenuTrigger asChild onKeyDown={openMenuFromKeyboard}>
                      <TableRow className="h-(--row-h)">
                        <TableCell className="max-w-0 min-w-40">
                          <Link
                            href={`/${workspace.slug}/members/${m.id}`}
                            className="flex min-w-0 items-center gap-2 rounded-(--r-xs) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                          >
                            <MemberAvatar name={m.name} color={m.color} size={24} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-(--text)">
                                {m.name}
                                {self && <span className="ml-1 text-(--text-3)">{t("org.members.me")}</span>}
                              </span>
                              <span className="block truncate text-(length:--fs-xs) text-(--text-3) xl:hidden">
                                {m.email}
                              </span>
                              {m.title && (
                                <span className="hidden truncate text-(length:--fs-xs) text-(--text-3) xl:block">
                                  {m.title}
                                </span>
                              )}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden max-w-56 truncate text-(--text-2) xl:table-cell">
                          {m.email}
                        </TableCell>
                        <TableCell>
                          {options.length > 0 ? (
                            <Select value={m.role} onValueChange={(v) => changeRole(m, v as Role)}>
                              <SelectTrigger size="sm" aria-label={t("org.members.roleOf", { name: m.name })} className="h-(--h-sm) w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {/* 현재 값이 선택지 밖이어도 보이도록 넣는다 */}
                                {[...new Set([m.role, ...options])].map((r) => (
                                  <SelectItem key={r} value={r} disabled={!options.includes(r)}>
                                    {t(`common.role.${r}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-(--text-2)">{t(`common.role.${m.role}`)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-(--text-2) md:table-cell">
                          {m.teamId ? (teamName.get(m.teamId) ?? "—") : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right text-(--text-2) tabular-nums lg:table-cell">
                          {stat?.projects ?? 0}
                        </TableCell>
                        <TableCell className="hidden text-right text-(--text-2) tabular-nums lg:table-cell">
                          {stat?.tasks ?? 0}
                        </TableCell>
                        <TableCell className="hidden text-(--text-3) xl:table-cell">
                          {m.lastActiveAt ? (
                            <time dateTime={m.lastActiveAt}>{f.relative(m.lastActiveAt, at)}</time>
                          ) : (
                            <span aria-label={t("org.members.noRecord")}>—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={STATUS_TONE[m.status]}>{t(`common.memberStatus.${m.status}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={t("org.members.menuOf", { name: m.name })}>
                                <MoreHorizontal aria-hidden strokeWidth={1.8} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {actions.map((a) =>
                                a.href ? (
                                  <DropdownMenuItem key={a.label} asChild>
                                    <Link href={a.href}>{a.label}</Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    key={a.label}
                                    variant={a.destructive ? "destructive" : "default"}
                                    onSelect={a.run}
                                  >
                                    {a.label}
                                  </DropdownMenuItem>
                                ),
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent
                      className="w-44"
                      aria-label={t("org.members.menuOf", { name: m.name })}
                      onCloseAutoFocus={(e) => {
                        const el = keyboardOpener.current;
                        keyboardOpener.current = null;
                        if (!el?.isConnected) return;
                        e.preventDefault();
                        el.focus();
                      }}
                    >
                      {actions.map((a) =>
                        a.href ? (
                          <ContextMenuItem key={a.label} asChild>
                            <Link href={a.href}>{a.label}</Link>
                          </ContextMenuItem>
                        ) : (
                          <ContextMenuItem
                            key={a.label}
                            variant={a.destructive ? "destructive" : "default"}
                            onSelect={a.run}
                          >
                            {a.label}
                          </ContextMenuItem>
                        ),
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {admin && (
        <section aria-labelledby="invites-title" className="px-(--gutter) pt-(--s-8) pb-(--s-8)">
          <h2 id="invites-title" className="text-(length:--fs-md) font-semibold text-(--text)">
            {t("org.members.invites.title")} <span className="text-(--text-3) tabular-nums">{invites.length}</span>
          </h2>
          <p className="mt-1 text-(length:--fs-sm) text-(--text-3)">{t("org.members.invites.note")}</p>
          {invites.length === 0 ? (
            <p className="mt-(--s-3) text-(length:--fs-sm) text-(--text-3)">{t("org.members.invites.empty")}</p>
          ) : (
            <ul className="mt-(--s-3) divide-y divide-(--divider) rounded-(--r) border border-(--border)">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-(--s-3) py-2">
                  <span className="min-w-0 flex-1 truncate text-(--text)">{i.email}</span>
                  <span className="text-(length:--fs-sm) text-(--text-2)">{t(`common.role.${i.role}`)}</span>
                  <span className="text-(length:--fs-xs) text-(--text-3)">
                    {i.invitedBy ? `${i.invitedBy} · ` : ""}
                    <time dateTime={i.createdAt}>{f.due(i.createdAt, at)}</time>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvite(i)}
                    aria-label={t("org.members.invites.revokeOf", { email: i.email })}
                  >
                    {t("org.members.invites.revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={t("org.members.confirmDeactivate.title")}
        description={t("org.members.confirmDeactivate.description", { name: confirm?.name ?? "" })}
        confirmLabel={t("org.members.deactivate")}
        onConfirm={async () => {
          if (!confirm) return null;
          const r = await setMemberStatus(workspace.id, confirm.id, "deactivated");
          if (!r.ok) return r.error;
          const msg = t("org.members.deactivated", { name: confirm.name });
          toast.success(msg);
          announce(msg);
          return null;
        }}
      />
    </>
  );
}
