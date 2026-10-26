"use client";
// 설정 > 환경 설정. 시작 화면·작업 여는 방식·보드 완료 열·삭제 전 확인. 컨트롤마다 바로 저장하고 실패하면 되돌린다
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/org/settings-parts";
import { announce } from "@/components/tasks/views/shared";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/client";
import { savePrefs } from "@/lib/org/actions";
import { START_TABS, TASK_OPEN_MODES, type UserPrefsView } from "@/lib/org/rules";

export function PreferencesForm({ workspaceId, initial }: { workspaceId: string; initial: UserPrefsView }) {
  const t = useT();
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  // 연달아 바꿔도 롤백 기준이 어긋나지 않게 최신 값은 ref로 읽는다
  const ref = useRef(prefs);

  const change = async <K extends keyof UserPrefsView>(key: K, value: UserPrefsView[K], label: string) => {
    const prev = ref.current;
    ref.current = { ...prev, [key]: value };
    setPrefs(ref.current);
    setBusy(true);
    const r = await savePrefs(workspaceId, { [key]: value });
    setBusy(false);
    if (!r.ok) {
      ref.current = prev;
      setPrefs(prev);
      return void toast.error(r.error);
    }
    const msg = t("org.settings.preferences.saved", { label });
    toast.success(msg);
    announce(msg);
  };

  const row = "flex items-start justify-between gap-4";
  const note = "text-(length:--fs-xs) text-(--text-3)";
  const startLabel = t("org.settings.preferences.startPage");
  const openLabel = t("org.settings.preferences.taskOpen");
  const doneLabel = t("org.settings.preferences.boardDone");
  const confirmLabel = t("org.settings.preferences.confirmDelete");

  return (
    <SettingsCard title={t("org.settings.section.preferences")} description={t("org.settings.preferences.description")}>
      <div className={row}>
        <Label htmlFor="pref-start" className="grid gap-0.5 font-normal">
          <span className="text-(length:--fs-base) text-(--text)">{startLabel}</span>
          <span className={note}>{t("org.settings.preferences.startPageNote")}</span>
        </Label>
        <Select value={prefs.startTab} disabled={busy} onValueChange={(v) => void change("startTab", v as UserPrefsView["startTab"], startLabel)}>
          <SelectTrigger id="pref-start" className="w-40 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {START_TABS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`org.settings.preferences.startPageOptions.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={row}>
        <Label htmlFor="pref-open" className="grid gap-0.5 font-normal">
          <span className="text-(length:--fs-base) text-(--text)">{openLabel}</span>
          <span className={note}>{t("org.settings.preferences.taskOpenNote")}</span>
        </Label>
        <Select value={prefs.taskOpen} disabled={busy} onValueChange={(v) => void change("taskOpen", v as UserPrefsView["taskOpen"], openLabel)}>
          <SelectTrigger id="pref-open" className="w-40 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_OPEN_MODES.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`org.settings.preferences.taskOpenOptions.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={row}>
        <Label htmlFor="pref-done" className="grid gap-0.5 font-normal">
          <span className="text-(length:--fs-base) text-(--text)">{doneLabel}</span>
          <span className={note}>{t("org.settings.preferences.boardDoneNote")}</span>
        </Label>
        <Switch id="pref-done" checked={prefs.showDoneBoard} disabled={busy} onCheckedChange={(v) => void change("showDoneBoard", v, doneLabel)} />
      </div>
      <div className={row}>
        <Label htmlFor="pref-confirm" className="grid gap-0.5 font-normal">
          <span className="text-(length:--fs-base) text-(--text)">{confirmLabel}</span>
          <span className={note}>{t("org.settings.preferences.confirmDeleteNote")}</span>
        </Label>
        <Switch id="pref-confirm" checked={prefs.confirmDel} disabled={busy} onCheckedChange={(v) => void change("confirmDel", v, confirmLabel)} />
      </div>
    </SettingsCard>
  );
}
