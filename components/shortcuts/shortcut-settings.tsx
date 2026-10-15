"use client";
// 설정 > 키보드 단축키 화면. 단축키 모달과 같은 SHORTCUT_GROUPS를 묶음별 카드로 읽기 전용으로 보인다
import { InfoRow, SettingsCard } from "@/components/org/settings-parts";
import { SHORTCUT_GROUPS } from "@/components/shortcuts/shortcut-list";
import { ShortcutKeys, useIsMac } from "@/components/shortcuts/shortcuts-dialog";

export function ShortcutSettings() {
  const mac = useIsMac();
  return SHORTCUT_GROUPS.map((group, i) => (
    <SettingsCard
      key={group.title}
      title={group.title}
      description={i === 0 ? "입력 칸에 커서가 있을 때는 한 글자 단축키가 동작하지 않습니다." : undefined}
    >
      {group.items.map((item) => (
        <InfoRow key={item.label} label={item.label} value={<ShortcutKeys item={item} mac={mac} />} />
      ))}
    </SettingsCard>
  ));
}
