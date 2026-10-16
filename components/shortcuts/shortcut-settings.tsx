"use client";
// 설정 > 키보드 단축키 화면. 단축키 모달과 같은 SHORTCUT_GROUPS를 묶음별 카드로 읽기 전용으로 보인다
import { InfoRow, SettingsCard } from "@/components/org/settings-parts";
import { SHORTCUT_GROUPS } from "@/components/shortcuts/shortcut-list";
import { ShortcutKeys, useIsMac } from "@/components/shortcuts/shortcuts-dialog";
import { useT } from "@/lib/i18n/client";

export function ShortcutSettings() {
  const t = useT();
  const mac = useIsMac();
  return SHORTCUT_GROUPS.map((group, i) => (
    <SettingsCard
      key={group.title}
      title={t(group.title)}
      description={i === 0 ? t("shortcuts.settingsHint") : undefined}
    >
      {group.items.map((item) => (
        <InfoRow key={item.label} label={t(item.label)} value={<ShortcutKeys item={item} mac={mac} />} />
      ))}
    </SettingsCard>
  ));
}
