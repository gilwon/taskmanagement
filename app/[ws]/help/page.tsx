// 도움말 화면. 시작하기, 작업과 보기, 키보드 단축키, 권한 요약을 앱 안의 내용으로만 보인다(외부 링크 없음)
import type { Metadata } from "next";
import { RolePermissionsTable } from "@/components/org/role-permissions";
import { InfoRow, SettingsCard } from "@/components/org/settings-parts";
import { PageHeader } from "@/components/shell/page-header";
import { ShortcutSettings } from "@/components/shortcuts/shortcut-settings";
import { NAV_LABELS, SHARE_PERM_LABELS } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: "도움말" };

const GETTING_STARTED = [
  ["프로젝트 만들기", "사이드바 프로젝트 옆 + 버튼이나 새로 만들기 메뉴에서 만듭니다. 게스트는 만들 수 없습니다."],
  ["작업 만들기", "N 키나 새로 만들기 메뉴의 새 작업으로 만듭니다. 보드 열 아래의 작업 추가로 그 상태에 바로 넣을 수도 있습니다."],
  ["구성원 초대", "소유자와 관리자가 구성원 화면이나 새로 만들기 메뉴에서 이메일로 초대합니다."],
  ["찾기와 이동", "⌘K(Windows는 Ctrl+K)로 커맨드 팔레트를 열어 화면·프로젝트·작업으로 이동합니다. /를 누르면 바로 검색 모드로 열립니다."],
] as const;

const VIEWS = [
  ["보드", "상태별 열에 카드가 놓입니다. 카드를 끌거나 Alt+화살표로 상태와 순서를 바꿉니다."],
  ["목록·표", "묶기·정렬·필터를 고르고, 칸을 눌러 상태·담당자·우선순위·기한을 바로 고칩니다."],
  ["캘린더", "기한이 있는 작업이 날짜 칸에 보입니다. 다른 날로 끌면 기한이 바뀝니다."],
  ["타임라인", "시작일부터 기한까지 막대로 보입니다. 막대를 끌어 일정을 옮기고 끝을 끌어 기간을 바꿉니다."],
  ["작업 상세", "작업을 누르면 오른쪽 드로어가 열립니다. E 키로 편집하고 댓글·파일·하위 작업을 다룹니다."],
  ["작업 메뉴", "작업을 우클릭하거나 Shift+F10을 누르면 상태·우선순위·담당자 변경, 복사, 즐겨찾기 메뉴가 열립니다."],
  ["저장 뷰", "지금의 필터·정렬·묶기를 이름을 붙여 저장하고 프로젝트 탭에서 다시 엽니다."],
  ["편집 권한", "프로젝트를 편집할 수 없으면 끌기·바로 고치기·작업 추가가 보이지 않습니다."],
] as const;

const PROJECT_PERMS = [
  ["view", "작업·파일·활동을 봅니다."],
  ["comment", "보기에 더해 댓글과 반응을 남깁니다."],
  ["edit", "작업을 만들고 고치고 옮깁니다."],
  ["full", "편집에 더해 프로젝트 설정(공개 범위·리드·보관)과 프로젝트 구성원을 관리합니다."],
] as const;

const text = (s: string) => <span className="text-(--text-2)">{s}</span>;

export default function HelpPage() {
  return (
    <>
      <PageHeader title="도움말" subtitle="이 워크스페이스를 쓰는 데 필요한 기본 사용법입니다." />
      <div className="max-w-3xl space-y-(--s-4) px-(--gutter) pb-(--s-8)">
        <SettingsCard title="시작하기">
          {GETTING_STARTED.map(([label, body]) => (
            <InfoRow key={label} label={label} value={text(body)} />
          ))}
        </SettingsCard>
        <SettingsCard title="작업과 보기">
          {VIEWS.map(([label, body]) => (
            <InfoRow key={label} label={label} value={text(body)} />
          ))}
        </SettingsCard>
        <h2 className="pt-(--s-2) text-(length:--fs-lg) font-semibold text-(--text)">키보드 단축키</h2>
        <ShortcutSettings />
        <SettingsCard title="워크스페이스 역할" description={`역할은 ${NAV_LABELS.members} 화면에서 소유자·관리자가 바꿉니다.`}>
          <RolePermissionsTable />
        </SettingsCard>
        <SettingsCard title="프로젝트 권한" description="구성원과 게스트에게 프로젝트마다 주는 권한입니다. 게스트는 댓글 가능까지만 받습니다.">
          {PROJECT_PERMS.map(([perm, body]) => (
            <InfoRow key={perm} label={SHARE_PERM_LABELS[perm]} value={text(body)} />
          ))}
        </SettingsCard>
      </div>
    </>
  );
}
