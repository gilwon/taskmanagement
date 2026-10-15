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
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { InfoRow, SettingsCard, SettingsTitle, UnavailableRow } from "@/components/org/settings-parts";
import { ShortcutSettings } from "@/components/shortcuts/shortcut-settings";
import { Button } from "@/components/ui/button";
import { getWorkspace, requireUserId } from "@/lib/data/workspace";
import { NAV_LABELS, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/i18n/labels";
import { getNotifPrefs, getOrgMembers, getTeams } from "@/lib/org/queries";
import { canOpenSettingsSection, isAdminRole } from "@/lib/org/rules";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ ws: string; section: string }>;

function find(section: string) {
  return Object.hasOwn(SETTINGS_SECTIONS, section) ? (section as SettingsSection) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const key = find((await params).section);
  return key ? { title: `${NAV_LABELS.settings} ${SETTINGS_SECTIONS[key].label}` } : {};
}

export default async function SettingsSectionPage({ params }: { params: Params }) {
  const { ws, section } = await params;
  const key = find(section);
  if (!key) notFound();
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const found = SETTINGS_SECTIONS[key];
  const header = <SettingsTitle title={found.label} subtitle={`${NAV_LABELS.settings} · ${found.group}`} />;
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
          <SettingsCard title="언어">
            <InfoRow label="표시 언어" value="한국어" note="현재 한국어만 지원합니다." />
          </SettingsCard>
        </>
      );
    case "datetime":
      return (
        <>
          {header}
          <SettingsCard title="날짜 및 시간" description="화면의 날짜와 시각은 Asia/Seoul 기준으로 표시합니다.">
            <TimezoneForm workspaceId={workspace.id} initial={me?.tz ?? "Asia/Seoul"} />
            <InfoRow label="한 주의 시작" value="월요일" note="변경을 제공하지 않습니다." />
            <InfoRow label="날짜 형식" value="10월 26일" note="변경을 제공하지 않습니다." />
            <InfoRow label="시간 형식" value="24시간제" note="변경을 제공하지 않습니다." />
          </SettingsCard>
        </>
      );
    case "members": {
      const active = members.filter((m) => m.status === "active").length;
      return (
        <>
          {header}
          <SettingsCard title="구성원" description={`활성 구성원 ${active}명 · 전체 ${members.length}명`}>
            {link("members", "구성원 관리")}
          </SettingsCard>
        </>
      );
    }
    case "teams": {
      const teams = await getTeams(workspace.id);
      return (
        <>
          {header}
          <SettingsCard title="팀" description={`팀 ${teams.length}개`}>
            {link("teams", "팀 관리")}
          </SettingsCard>
        </>
      );
    }
    case "projects":
      return (
        <>
          {header}
          <SettingsCard title="프로젝트" description="프로젝트 만들기·보관·삭제는 프로젝트 화면과 보관함에서 합니다.">
            {link("projects", "프로젝트 보기")}
          </SettingsCard>
        </>
      );
    case "permissions":
      return (
        <>
          {header}
          <SettingsCard
            title="역할별 권한"
            description="역할은 구성원 화면에서 소유자·관리자가 바꿉니다. 누구도 자기 역할을 스스로 바꿀 수 없습니다."
          >
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
          <SettingsCard title="환경 설정" description="아래 항목은 아직 바꿀 수 없습니다. 화면 모양은 화면 설정에서 바꿉니다.">
            <UnavailableRow label="시작 화면" description="지금은 홈으로 시작합니다." />
            <UnavailableRow label="작업 여는 방식" description="지금은 오른쪽 패널로 엽니다." />
            <UnavailableRow label="보드에 완료 열 표시" />
            <UnavailableRow label="삭제 전 확인" />
          </SettingsCard>
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
          <SettingsCard title="2단계 인증">
            <UnavailableRow label="2단계 인증" description="이 기능은 현재 제공하지 않습니다." />
          </SettingsCard>
        </>
      );
    case "billing":
      return (
        <>
          {header}
          <SettingsCard title="결제" description="결제 기능은 현재 제공하지 않습니다. 요금이 청구되지 않습니다.">
            <UnavailableRow label="요금제" />
            <UnavailableRow label="결제 수단" />
            <UnavailableRow label="청구서" />
          </SettingsCard>
        </>
      );
  }
}
