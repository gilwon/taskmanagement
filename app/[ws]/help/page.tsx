// 도움말 화면. 시작하기, 작업과 보기, 키보드 단축키, 권한 요약을 앱 안의 내용으로만 보인다(외부 링크 없음)
import type { Metadata } from "next";
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { InfoRow, SettingsCard } from "@/components/org/settings-parts";
import { PageHeader } from "@/components/shell/page-header";
import { ShortcutSettings } from "@/components/shortcuts/shortcut-settings";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("help.title") };
}

// 항목 이름은 help 사전의 키다
const GETTING_STARTED = ["createProject", "createTask", "invite", "find"] as const;
const VIEWS = ["board", "list", "calendar", "timeline", "detail", "taskMenu", "savedView", "editPermission"] as const;
const PROJECT_PERMS = ["view", "comment", "edit", "full"] as const;

const text = (s: string) => <span className="text-(--text-2)">{s}</span>;

export default async function HelpPage() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
      <div className="max-w-3xl space-y-(--s-4) px-(--gutter) pb-(--s-8)">
        <SettingsCard title={t("help.gettingStarted.title")}>
          {GETTING_STARTED.map((k) => (
            <InfoRow key={k} label={t(`help.gettingStarted.${k}.label`)} value={text(t(`help.gettingStarted.${k}.body`))} />
          ))}
        </SettingsCard>
        <SettingsCard title={t("help.views.title")}>
          {VIEWS.map((k) => (
            <InfoRow key={k} label={t(`help.views.${k}.label`)} value={text(t(`help.views.${k}.body`))} />
          ))}
        </SettingsCard>
        <h2 className="pt-(--s-2) text-(length:--fs-lg) font-semibold text-(--text)">{t("help.shortcutsTitle")}</h2>
        <ShortcutSettings />
        <SettingsCard title={t("help.roles.title")} description={t("help.roles.description", { members: t("common.nav.members") })}>
          <RolePermissionsTable />
        </SettingsCard>
        <SettingsCard title={t("help.projectPerms.title")} description={t("help.projectPerms.description")}>
          {PROJECT_PERMS.map((perm) => (
            <InfoRow key={perm} label={t(`common.sharePerm.${perm}`)} value={text(t(`help.projectPerms.${perm}`))} />
          ))}
        </SettingsCard>
      </div>
    </>
  );
}
