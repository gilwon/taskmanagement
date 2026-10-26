// 설정 섹션. 허용 목록 밖의 섹션은 404, 역할로 막는 섹션(게스트의 구성원·팀·권한)은 403. 동작하는 항목만 입력을 두고, 바꿀 수 없는 값은 읽기 전용, 미제공 항목은 미제공으로 보인다(spec R23)
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import {
  AppearanceForm,
  DangerZone,
  GeneralForm,
  NotificationsForm,
  PasswordForm,
  ProfileForm,
  SessionsPanel,
  TimezoneForm,
} from "@/components/org/settings-forms";
import { LanguageForm } from "@/components/org/language-form";
import { PreferencesForm } from "@/components/org/preferences-form";
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { InfoRow, SettingsCard, SettingsTitle, UnavailableRow } from "@/components/org/settings-parts";
import { ShortcutSettings } from "@/components/shortcuts/shortcut-settings";
import { Button } from "@/components/ui/button";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/i18n/labels";
import { getFormatter, getT } from "@/lib/i18n/server";
import { getNotifPrefs, getOrgMembers, getTeams, getUserPrefs } from "@/lib/org/queries";
import { canOpenSettingsSection, isAdminRole } from "@/lib/org/rules";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ ws: string; section: string }>;

function find(section: string) {
  return Object.hasOwn(SETTINGS_SECTIONS, section) ? (section as SettingsSection) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const key = find((await params).section);
  if (!key) return {};
  const t = await getT();
  return { title: t("org.settings.pageTitle", { settings: t("common.nav.settings"), section: t(`org.settings.section.${key}`) }) };
}

export default async function SettingsSectionPage({ params }: { params: Params }) {
  const { ws, section } = await params;
  const key = find(section);
  if (!key) notFound();
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const [t, format] = await Promise.all([getT(), getFormatter()]);
  const title = t(`org.settings.section.${key}`);
  const header = (
    <SettingsTitle
      title={title}
      subtitle={t("org.settings.subtitle", { settings: t("common.nav.settings"), group: t(`org.settings.groupOf.${key}`) })}
    />
  );
  const members = await getOrgMembers(workspace.id);
  const me = members.find((m) => m.id === userId);
  if (!canOpenSettingsSection(me?.role, key)) forbidden();
  const link = (href: string, label: string) => (
    <div>
      <Button asChild variant="outline">
        <Link href={`/${workspace.slug}/${href}`}>{label}</Link>
      </Button>
    </div>
  );

  switch (key) {
    case "general":
      return (
        <>
          {header}
          <GeneralForm workspace={workspace} canEdit={isAdminRole(me?.role)} />
          {me?.role === "owner" && <DangerZone workspace={workspace} />}
        </>
      );
    case "appearance":
      return (
        <>
          {header}
          <AppearanceForm />
        </>
      );
    case "language":
      return (
        <>
          {header}
          <SettingsCard title={title}>
            <LanguageForm />
          </SettingsCard>
        </>
      );
    case "datetime":
      return (
        <>
          {header}
          <SettingsCard title={title} description={t("org.settings.datetime.description")}>
            <TimezoneForm workspaceId={workspace.id} initial={me?.tz ?? "Asia/Seoul"} />
            <InfoRow label={t("org.settings.datetime.weekStart")} value={t("org.settings.datetime.sunday")} note={t("org.settings.notChangeable")} />
            {/* 날짜 형식 예시는 현재 로캘의 실제 표기로 보인다 */}
            <InfoRow label={t("org.settings.datetime.dateFormat")} value={format.date("2026-10-26")} note={t("org.settings.notChangeable")} />
            <InfoRow label={t("org.settings.datetime.timeFormat")} value={t("org.settings.datetime.hour24")} note={t("org.settings.notChangeable")} />
          </SettingsCard>
        </>
      );
    case "members": {
      const active = members.filter((m) => m.status === "active").length;
      return (
        <>
          {header}
          <SettingsCard title={title} description={t("org.settings.members.description", { active, total: members.length })}>
            {link("members", t("org.settings.members.manage"))}
          </SettingsCard>
        </>
      );
    }
    case "teams": {
      const teams = await getTeams(workspace.id);
      return (
        <>
          {header}
          <SettingsCard title={title} description={t("org.settings.teams.description", { count: teams.length })}>
            {link("teams", t("org.settings.teams.manage"))}
          </SettingsCard>
        </>
      );
    }
    case "projects":
      return (
        <>
          {header}
          <SettingsCard title={title} description={t("org.settings.projects.description")}>
            {link("projects", t("org.settings.projects.view"))}
          </SettingsCard>
        </>
      );
    case "permissions":
      return (
        <>
          {header}
          <SettingsCard title={t("org.settings.permissions.title")} description={t("org.settings.permissions.description")}>
            <RolePermissionsTable />
          </SettingsCard>
        </>
      );
    case "notifications":
      return (
        <>
          {header}
          <NotificationsForm workspaceId={workspace.id} initial={await getNotifPrefs(workspace.id, userId)} />
        </>
      );
    case "profile":
      return (
        <>
          {header}
          <ProfileForm
            workspaceId={workspace.id}
            initial={{ name: me?.name ?? "", title: me?.title ?? "", email: me?.email ?? "" }}
          />
        </>
      );
    case "preferences":
      return (
        <>
          {header}
          <PreferencesForm workspaceId={workspace.id} initial={await getUserPrefs(workspace.id, userId)} />
        </>
      );
    case "shortcuts":
      return (
        <>
          {header}
          <ShortcutSettings />
        </>
      );
    case "password":
      return (
        <>
          {header}
          <PasswordForm />
        </>
      );
    case "sessions": {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return (
        <>
          {header}
          <SessionsPanel email={data.user?.email ?? me?.email ?? ""} lastSignIn={data.user?.last_sign_in_at ?? null} />
        </>
      );
    }
    case "two-factor":
      return (
        <>
          {header}
          <SettingsCard title={title}>
            <UnavailableRow label={title} description={t("org.settings.twoFactor.note")} />
          </SettingsCard>
        </>
      );
  }
}
