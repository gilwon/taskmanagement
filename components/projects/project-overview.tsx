"use client";
// 프로젝트 개요 탭 본문. 소개·진행률·다가오는 작업·마일스톤·최근 활동(왼쪽)과 세부 정보·구성원 권한(오른쪽).
// 상태·기간·설명·마일스톤은 편집 권한, 리드·공개 범위·구성원 권한·보관은 관리 권한일 때만 고칠 수 있다(DB도 같은 규칙으로 거부한다)
import { ArchiveRestore, Diamond, Pencil, Plus, Trash, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActivityRow } from "@/components/activity/activity-row";
import { Panel } from "@/components/home/parts";
import { ICON, LINK_CLS, ProgressBar } from "@/components/projects/parts";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectStatusDot } from "@/components/shell/project-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker, DueLabel, StatusIcon, TaskKey } from "@/components/tasks/parts";
import { announce } from "@/components/tasks/views/shared";
import type { HomeActivity } from "@/lib/home/queries";
import { useFormatter, useT } from "@/lib/i18n/client";
import { PROJECT_STATUS_LABELS } from "@/lib/i18n/labels";
import {
  addProjectMember,
  createMilestone,
  deleteMilestone,
  removeProjectMember,
  setProjectArchived,
  setProjectMemberPerm,
  updateMilestone,
  updateProject,
} from "@/lib/projects/actions";
import type { ProjectDetail } from "@/lib/projects/queries";
import { TASK_STATUSES, taskStats } from "@/lib/projects/stats";
import type { ProjectAccess, ProjectPatch, ProjectStatus, SharePerm } from "@/lib/projects/types";
import type { WorkspaceMember } from "@/lib/tasks/types";

const PERMS: SharePerm[] = ["view", "comment", "edit", "full"];
const NO_LEAD = "none";

type Result = { ok: true } | { ok: false; error: string };

// 결과를 토스트·#sr-live로 알린다. 성공하면 Server Action의 refresh가 화면 값을 새로 내려 준다
async function run(fn: () => Promise<Result>, done: string) {
  const r = await fn();
  if (!r.ok) {
    toast.error(r.error);
    return false;
  }
  announce(done);
  return true;
}

type Props = {
  detail: ProjectDetail;
  members: WorkspaceMember[];
  meId: string;
  wsAdmin: boolean;
  workspace: { id: string; slug: string; name: string };
  activities: HomeActivity[];
  nowIso: string;
};

export function ProjectOverview({ detail, members, meId, wsAdmin, workspace, activities, nowIso }: Props) {
  const t = useT();
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const stats = useMemo(() => taskStats(detail.tasks, now), [detail.tasks, now]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const canEdit = detail.perm === "edit" || detail.perm === "full";
  const canManage = detail.perm === "full";
  const base = `/${workspace.slug}/projects/${encodeURIComponent(detail.key)}`;

  return (
    <div className="px-(--gutter) pt-(--s-4) pb-(--s-8)">
      {detail.archivedAt && (
        <div
          role="status"
          className="mb-(--s-4) flex flex-wrap items-center gap-2 rounded-(--r) bg-(--amber-soft) px-3 py-2 text-(length:--fs-sm) text-(--amber)"
        >
          <span className="flex-1">{t("projects.detail.archivedNotice")}</span>
          {canManage && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => void run(() => setProjectArchived(detail.id, false), t("projects.archive.unarchived"))}
            >
              <ArchiveRestore {...ICON} />
              {t("projects.menu.unarchive")}
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start gap-(--s-4) max-[1100px]:grid-cols-1">
        <div className="grid min-w-0 gap-(--s-4)">
          <AboutPanel detail={detail} canEdit={canEdit} />
          <Panel title={t("projects.detail.progress")} titleId="po-progress" delay={40}>
            <div className="flex flex-col gap-(--s-3) px-(--s-4) py-(--s-3)">
              <ProgressBar pct={stats.pct} label={t("projects.progressOf", { name: detail.name })} />
              <p className="text-(length:--fs-sm) text-(--text-3)">
                {t("projects.detail.progressSummary", { count: stats.total, done: stats.done, open: stats.open })}
                {stats.overdue > 0 && <span className="text-(--red)"> · {t("projects.detail.overdueCount", { count: stats.overdue })}</span>}
              </p>
              <ul aria-label={t("projects.detail.statusCounts")} className="grid grid-cols-5 gap-2 max-[640px]:grid-cols-3">
                {TASK_STATUSES.map((s) => (
                  <li key={s} className="flex min-w-0 flex-col gap-1 rounded-(--r) bg-(--surface-2) px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-(length:--fs-xs) text-(--text-3)">
                      <StatusIcon status={s} size={12} />
                      <span className="truncate" aria-hidden>
                        {t(`common.taskStatus.${s}`)}
                      </span>
                    </span>
                    <span className="text-(length:--fs-lg) font-semibold text-(--text) tabular-nums">{stats.byStatus[s]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel title={t("projects.detail.upcoming")} titleId="po-upcoming" delay={80}>
            {detail.upcoming.length === 0 ? (
              <p className="px-(--s-4) py-(--s-5) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.detail.noUpcoming")}</p>
            ) : (
              <ul>
                {detail.upcoming.map((task) => {
                  const a = task.assignee_id ? byId.get(task.assignee_id) : undefined;
                  return (
                    <li
                      key={task.id}
                      className="flex h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--s-4) last:border-b-0 hover:bg-(--surface-2)"
                    >
                      <StatusIcon status={task.status} />
                      <TaskKey value={task.key} />
                      <Link href={`/${workspace.slug}/task/${task.key}`} className={`${LINK_CLS} min-w-0 flex-1 truncate text-(--text)`}>
                        {task.title}
                      </Link>
                      {a && <MemberAvatar name={a.name} color={a.color} size={20} />}
                      <DueLabel due={task.due_date} now={now} className="w-16 shrink-0 text-right text-(length:--fs-sm)" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <MilestonesPanel detail={detail} canEdit={canEdit} now={now} />
          <Panel
            title={t("projects.detail.recentActivity")}
            titleId="po-activity"
            delay={160}
            action={
              <Link href={`${base}/activity`} className={`${LINK_CLS} text-(length:--fs-sm) text-(--text-3)`}>
                {t("projects.detail.allActivity")}
              </Link>
            }
          >
            {activities.length === 0 ? (
              <p className="px-(--s-4) py-(--s-5) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.detail.noActivity")}</p>
            ) : (
              <ul className="flex flex-col gap-(--s-3) px-(--s-4) py-(--s-3)">
                {activities.map((a) => (
                  <li key={a.id}>
                    <ActivityRow
                      a={a}
                      now={now}
                      wsSlug={workspace.slug}
                      member={(id) => byId.get(id)}
                      onOpenTask={(key) => router.push(`/${workspace.slug}/task/${key}`)}
                      showProject={false}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="grid min-w-0 gap-(--s-4)">
          <DetailsPanel detail={detail} members={members} canEdit={canEdit} canManage={canManage} workspaceName={workspace.name} now={now} />
          <MembersPanel detail={detail} members={members} meId={meId} wsAdmin={wsAdmin} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 소개
// ─────────────────────────────────────────────

function AboutPanel({ detail, canEdit }: { detail: ProjectDetail; canEdit: boolean }) {
  const t = useT();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(detail.description ?? "");
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const ok = await run(() => updateProject(detail.id, { description: draft.trim() || null }), t("projects.detail.descriptionSaved"));
    setPending(false);
    if (ok) setEditing(false);
  };

  return (
    <Panel
      title={t("projects.detail.about")}
      titleId="po-about"
      action={
        canEdit &&
        !editing && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setDraft(detail.description ?? "");
              setEditing(true);
            }}
          >
            <Pencil {...ICON} />
            {t("projects.detail.edit")}
          </Button>
        )
      }
    >
      <div className="px-(--s-4) py-(--s-3)">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void save();
              }
            }}
            className="flex flex-col gap-2"
            aria-busy={pending}
          >
            <label htmlFor={`${uid}-desc`} className="sr-only">
              {t("projects.detail.descriptionLabel")}
            </label>
            <Textarea id={`${uid}-desc`} autoFocus rows={4} maxLength={5000} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                {t("common.action.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {t("common.action.save")}
              </Button>
            </div>
          </form>
        ) : detail.description ? (
          <p className="text-(length:--fs-base) whitespace-pre-wrap text-(--text-2)">{detail.description}</p>
        ) : (
          <p className="text-(length:--fs-sm) text-(--text-4)">{t("projects.detail.noDescription")}</p>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 세부 정보
// ─────────────────────────────────────────────

const chip =
  "inline-flex h-(--h-sm) max-w-full items-center gap-1.5 rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 text-(length:--fs-sm) text-(--text-2) outline-none hover:border-(--border-strong) hover:text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent) disabled:opacity-60 disabled:hover:border-(--border)";

function DetailRow({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3 border-b border-(--divider) px-(--s-4) last:border-b-0">
      <dt id={id} className="w-20 shrink-0 text-(length:--fs-sm) text-(--text-3)">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center">{children}</dd>
    </div>
  );
}

function DetailsPanel({
  detail,
  members,
  canEdit,
  canManage,
  workspaceName,
  now,
}: {
  detail: ProjectDetail;
  members: WorkspaceMember[];
  canEdit: boolean;
  canManage: boolean;
  workspaceName: string;
  now: Date;
}) {
  const t = useT();
  const f = useFormatter();
  const uid = useId();
  const save = (patch: ProjectPatch, done: string) => void run(() => updateProject(detail.id, patch), done);
  const lead = detail.leadId ? members.find((m) => m.id === detail.leadId) : undefined;
  const leadOptions = members.filter((m) => m.status !== "deactivated" || m.id === detail.leadId);
  const datePick = (field: "startDate" | "dueDate", label: string) => {
    const value = field === "startDate" ? detail.startDate : detail.dueDate;
    return (
      <DatePicker
        label={label}
        value={value}
        disabled={!canEdit}
        onChange={(v) => {
          const start = field === "startDate" ? v : detail.startDate;
          const due = field === "dueDate" ? v : detail.dueDate;
          if (start && due && start > due) return void toast.error(t("projects.errors.startAfterDue"));
          save({ [field]: v }, field === "startDate" ? t("projects.details.startDateSaved") : t("projects.details.dueDateSaved"));
        }}
      >
        <button type="button" className={chip} aria-labelledby={`${uid}-${field} ${uid}-${field}-v`}>
          <span id={`${uid}-${field}-v`}>{value ? f.due(value, now) : t("projects.details.unset")}</span>
        </button>
      </DatePicker>
    );
  };

  return (
    <Panel title={t("projects.details.title")} titleId="po-details" delay={40}>
      <dl>
        <DetailRow label={t("projects.details.key")} id={`${uid}-key`}>
          <span className="font-mono text-(length:--fs-sm) text-(--text-2)">{detail.key}</span>
        </DetailRow>
        <DetailRow label={t("projects.details.status")} id={`${uid}-status`}>
          <Select
            value={detail.status}
            disabled={!canEdit}
            onValueChange={(v) => save({ status: v as ProjectStatus }, t("projects.details.statusChanged"))}
          >
            <SelectTrigger size="sm" aria-labelledby={`${uid}-status`} className={`${chip} w-auto`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  <ProjectStatusDot status={s} />
                  {t(`common.projectStatus.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DetailRow>
        <DetailRow label={t("projects.details.lead")} id={`${uid}-lead`}>
          <Select
            value={detail.leadId ?? NO_LEAD}
            disabled={!canManage}
            onValueChange={(v) => save({ leadId: v === NO_LEAD ? null : v }, t("projects.details.leadChanged"))}
          >
            <SelectTrigger
              size="sm"
              aria-labelledby={`${uid}-lead`}
              className={`${chip} w-auto`}
              title={canManage ? undefined : t("projects.details.needFull")}
            >
              <SelectValue>
                {lead ? (
                  <>
                    <MemberAvatar name={lead.name} color={lead.color} size={18} />
                    {lead.name}
                  </>
                ) : (
                  t("common.noLead")
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LEAD}>{t("common.noLead")}</SelectItem>
              {leadOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <MemberAvatar name={m.name} color={m.color} size={18} />
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DetailRow>
        <DetailRow label={t("projects.details.startDate")} id={`${uid}-startDate`}>
          {datePick("startDate", t("projects.details.startDate"))}
        </DetailRow>
        <DetailRow label={t("projects.details.dueDate")} id={`${uid}-dueDate`}>
          {datePick("dueDate", t("projects.details.dueDate"))}
        </DetailRow>
        <DetailRow label={t("projects.details.access")} id={`${uid}-access`}>
          <Select
            value={detail.access}
            disabled={!canManage}
            onValueChange={(v) => save({ access: v as ProjectAccess }, t("projects.details.accessChanged"))}
          >
            <SelectTrigger size="sm" aria-labelledby={`${uid}-access`} className={`${chip} w-auto max-w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["workspace", "private"] as const).map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`common.generalAccess.${a}`, { ws: workspaceName })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DetailRow>
      </dl>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 마일스톤
// ─────────────────────────────────────────────

function MilestoneForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; date: string | null };
  submitLabel: string;
  onSubmit: (name: string, date: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const t = useT();
  const f = useFormatter();
  const uid = useId();
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState<string | null>(initial.date);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError(t("projects.milestones.nameRequired"));
        if (!date) return setError(t("projects.milestones.dateRequired"));
        setError(null);
        setPending(true);
        const ok = await onSubmit(name.trim(), date);
        setPending(false);
        if (ok && !onCancel) {
          setName("");
          setDate(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="flex flex-col gap-1.5"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={`${uid}-name`} className="sr-only">
          {t("projects.milestones.name")}
        </label>
        <Input
          id={`${uid}-name`}
          value={name}
          maxLength={120}
          autoFocus={!!onCancel}
          placeholder={t("projects.milestones.name")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
          onChange={(e) => setName(e.target.value)}
          className="h-(--h-sm) min-w-0 flex-1 basis-40 text-(length:--fs-sm)"
        />
        <DatePicker label={t("projects.milestones.date")} value={date} onChange={setDate}>
          <button type="button" className={chip}>
            {date ? f.due(date, now) : t("projects.milestones.datePlaceholder")}
          </button>
        </DatePicker>
        {onCancel && (
          <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
            {t("common.action.cancel")}
          </Button>
        )}
        <Button type="submit" size="xs" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {error && (
        <p id={`${uid}-err`} role="alert" className="text-(length:--fs-xs) text-(--red)">
          {error}
        </p>
      )}
    </form>
  );
}

function MilestonesPanel({ detail, canEdit, now }: { detail: ProjectDetail; canEdit: boolean; now: Date }) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Panel title={t("projects.milestones.title")} titleId="po-milestones" delay={120}>
      {detail.milestones.length === 0 && (
        <p className="px-(--s-4) pt-(--s-4) pb-(--s-2) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.milestones.empty")}</p>
      )}
      <ul>
        {detail.milestones.map((m) => (
          <li key={m.id} className="flex min-h-(--row-h) items-center gap-2 border-b border-(--divider) px-(--s-4) py-1.5">
            {editing === m.id ? (
              <div className="flex-1">
                <MilestoneForm
                  initial={{ name: m.name, date: m.date }}
                  submitLabel={t("common.action.save")}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (name, date) => {
                    const ok = await run(() => updateMilestone(m.id, name, date), t("projects.milestones.saved"));
                    if (ok) setEditing(null);
                    return ok;
                  }}
                />
              </div>
            ) : (
              <>
                <Diamond size={12} strokeWidth={1.8} aria-hidden className="shrink-0 fill-(--accent) text-(--accent)" />
                <span className="min-w-0 flex-1 truncate text-(length:--fs-sm) text-(--text)">{m.name}</span>
                <DueLabel due={m.date} now={now} className="shrink-0 text-(length:--fs-xs)" />
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon-xs" aria-label={t("projects.milestones.editItem", { name: m.name })} onClick={() => setEditing(m.id)}>
                      <Pencil {...ICON} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("projects.milestones.deleteItem", { name: m.name })}
                      onClick={() => void run(() => deleteMilestone(m.id), t("projects.milestones.deleted", { name: m.name }))}
                    >
                      <Trash {...ICON} />
                    </Button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="px-(--s-4) py-(--s-3)">
          <MilestoneForm
            initial={{ name: "", date: null }}
            submitLabel={t("projects.add")}
            onSubmit={(name, date) => run(() => createMilestone(detail.id, name, date), t("projects.milestones.added"))}
          />
        </div>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────
// 구성원과 권한
// ─────────────────────────────────────────────

function MembersPanel({
  detail,
  members,
  meId,
  wsAdmin,
  canManage,
}: {
  detail: ProjectDetail;
  members: WorkspaceMember[];
  meId: string;
  wsAdmin: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const uid = useId();
  const byId = new Map(members.map((m) => [m.id, m]));
  const inProject = new Set(detail.members.map((m) => m.userId));
  const candidates = members.filter((m) => !inProject.has(m.id) && m.status !== "deactivated");
  const [pick, setPick] = useState<string>("");
  const [perm, setPerm] = useState<SharePerm>("edit");
  const picked = candidates.find((m) => m.id === pick);

  // 게스트는 댓글까지만 쓸 수 있고, 관리자가 아니면 자기 권한을 지금보다 올릴 수 없다(DB 트리거도 거부한다)
  const disabledPerm = (target: WorkspaceMember | undefined, current: SharePerm | null, p: SharePerm) =>
    (target?.role === "guest" && PERMS.indexOf(p) > PERMS.indexOf("comment")) ||
    (target?.id === meId && !wsAdmin && current !== null && PERMS.indexOf(p) > PERMS.indexOf(current));

  return (
    <Panel title={t("projects.members.title")} titleId="po-members" delay={80}>
      <p className="px-(--s-4) pt-(--s-3) text-(length:--fs-xs) text-(--text-3)">
        {t("projects.members.adminNote")}{" "}
        {detail.access === "workspace" ? t("projects.members.publicNote") : t("projects.members.privateNote")}
      </p>
      {detail.members.length === 0 ? (
        <p className="px-(--s-4) py-(--s-4) text-center text-(length:--fs-sm) text-(--text-3)">{t("projects.members.empty")}</p>
      ) : (
        <ul className="py-(--s-1)">
          {detail.members.map((pm) => {
            const m = byId.get(pm.userId);
            const name = m?.name ?? t("common.unknownUser");
            return (
              <li key={pm.userId} className="flex min-h-(--row-h) items-center gap-2 px-(--s-4)">
                <MemberAvatar name={name} color={m?.color} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-(length:--fs-sm) text-(--text)">
                    {name}
                    {pm.userId === meId && <span className="text-(--text-3)">{t("projects.members.meSuffix")}</span>}
                  </span>
                  {m && <span className="block text-(length:--fs-2xs) text-(--text-3)">{t(`common.role.${m.role}`)}</span>}
                </span>
                {canManage ? (
                  <>
                    <Select
                      value={pm.perm}
                      onValueChange={(v) =>
                        void run(() => setProjectMemberPerm(detail.id, pm.userId, v as SharePerm), t("projects.members.permChanged", { name }))
                      }
                    >
                      <SelectTrigger size="sm" aria-label={t("projects.members.permOf", { name })} className={`${chip} w-auto`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {PERMS.map((p) => (
                          <SelectItem key={p} value={p} disabled={disabledPerm(m, pm.perm, p)}>
                            {t(`common.sharePerm.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("projects.members.remove", { name })}
                      onClick={() => void run(() => removeProjectMember(detail.id, pm.userId), t("projects.members.removed", { name }))}
                    >
                      <UserMinus {...ICON} />
                    </Button>
                  </>
                ) : (
                  <span className="text-(length:--fs-xs) text-(--text-3)">{t(`common.sharePerm.${pm.perm}`)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canManage && candidates.length > 0 && (
        <form
          className="flex flex-wrap items-center gap-1.5 border-t border-(--divider) px-(--s-4) py-(--s-3)"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!picked) return;
            const p = disabledPerm(picked, null, perm) ? "comment" : perm;
            const ok = await run(() => addProjectMember(detail.id, picked.id, p), t("projects.members.added", { name: picked.name }));
            if (ok) setPick("");
          }}
        >
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger size="sm" aria-label={t("projects.members.addWho")} className={`${chip} min-w-0 flex-1 basis-32`}>
              <SelectValue placeholder={t("projects.members.pick")} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <MemberAvatar name={m.name} color={m.color} size={18} />
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={perm} onValueChange={(v) => setPerm(v as SharePerm)}>
            <SelectTrigger size="sm" aria-label={t("projects.members.addPerm")} id={`${uid}-perm`} className={`${chip} w-auto`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PERMS.map((p) => (
                <SelectItem key={p} value={p} disabled={disabledPerm(picked, null, p)}>
                  {t(`common.sharePerm.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="xs" disabled={!picked}>
            <Plus {...ICON} />
            {t("projects.add")}
          </Button>
        </form>
      )}
    </Panel>
  );
}
