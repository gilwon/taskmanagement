"use client";
// 표시 언어 선택. 고르면 프로필·쿠키에 저장하고 서버 렌더를 새로 받아 화면 문구를 바꾼다
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { announce } from "@/components/tasks/views/shared";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { SELECTABLE_LOCALES, type Locale } from "@/lib/i18n/locales";
import { LOCALE_NAMES } from "@/lib/i18n/messages/locale-names";

export function LanguageForm() {
  const t = useT();
  const router = useRouter();
  const [locale, setValue] = useState<Locale>(useLocale());
  const [busy, setBusy] = useState(false);

  const change = async (next: string) => {
    const prev = locale;
    setValue(next as Locale);
    setBusy(true);
    const r = await setLocale(next);
    setBusy(false);
    if (!r.ok) {
      setValue(prev);
      return void toast.error(r.error);
    }
    const msg = t("org.settings.language.saved", { name: LOCALE_NAMES[next as Locale] });
    toast.success(msg);
    announce(msg);
    router.refresh();
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="locale-select">{t("org.settings.language.label")}</Label>
      <Select value={locale} onValueChange={change} disabled={busy}>
        <SelectTrigger id="locale-select" className="w-full sm:w-72" aria-describedby="locale-hint">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SELECTABLE_LOCALES.map((l) => (
            <SelectItem key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="locale-hint" className="text-(length:--fs-xs) text-(--text-3)">
        {t("org.settings.language.hint")}
      </p>
    </div>
  );
}
