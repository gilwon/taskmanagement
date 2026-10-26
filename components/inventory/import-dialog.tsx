"use client";
// 재고 엑셀 업로드 대화상자. 파일 선택 → 읽은 결과·형식 오류 확인 + 메모 → 업로드 순서로 진행한다. 형식 검사는 편의용이고 최종 판정은 서버·DB가 한다
import { Download } from "lucide-react";
import { useId, useState } from "react";
import { useInventory } from "@/components/inventory/use-inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { importStock } from "@/lib/inventory/actions";
import { importReason } from "@/lib/inventory/errors";
import { parseImportSheet, type ImportRow, type ImportRowError, type ImportSummary } from "@/lib/inventory/import";
import { downloadImportTemplate } from "@/lib/inventory/import-template";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; workspaceId: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// 목록에 보이는 최대 오류 수
const MAX_SHOWN_ERRORS = 20;

export function ImportDialog({ open, onOpenChange, workspaceId }: Props) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("inventory.import.title")}</DialogTitle>
          <DialogDescription>{t("inventory.import.description")}</DialogDescription>
        </DialogHeader>
        {/* 대화상자가 닫히면 언마운트되므로 열 때마다 입력 상태가 초기화된다 */}
        <ImportForm workspaceId={workspaceId} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const t = useT();
  const id = useId();
  const { run, pending } = useInventory();
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  // 앱 형식 검사 오류와 서버가 돌려준 행 오류. 같은 목록 형식으로 보인다
  const [formatErrors, setFormatErrors] = useState<ImportRowError[]>([]);
  const [serverErrors, setServerErrors] = useState<ImportRowError[]>([]);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);

  const reset = () => {
    setFileError(null);
    setRows(null);
    setFormatErrors([]);
    setServerErrors([]);
    setFormError(null);
    setDone(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    reset();
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return setFileError(t("inventory.import.fileError.notXlsx"));
    if (file.size > MAX_FILE_BYTES) return setFileError(t("inventory.import.fileError.tooLarge"));
    setReading(true);
    try {
      // 파서는 파일을 고른 뒤에 불러와 처음 화면 번들에 싣지 않는다
      const { readSheet } = await import("read-excel-file/browser");
      const parsed = parseImportSheet(await readSheet(file));
      setRows(parsed.rows);
      setFormatErrors(parsed.errors);
    } catch {
      setFileError(t("inventory.import.fileError.readFailed"));
    } finally {
      setReading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || reading || !rows || formatErrors.length > 0) return;
    const memo = note.trim();
    setNoteError(memo ? null : t("inventory.import.errNote"));
    setFormError(null);
    setServerErrors([]);
    if (!memo) return;

    const r = await run(async () => {
      const result = await importStock(workspaceId, rows, memo);
      if (!result.ok) setServerErrors(result.rowErrors ?? []);
      return result;
    }, t("inventory.import.toast"));
    if (r.ok) setDone(r.data);
    else if (r.error) setFormError(r.error);
  };

  const errors = [...formatErrors, ...serverErrors];

  return (
    <form onSubmit={submit} method="post" noValidate className="grid gap-4">
      {formError && (
        <p role="alert" className="rounded-(--r-sm) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
          {formError}
        </p>
      )}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-file`}>{t("inventory.import.file")}</Label>
          <Button type="button" variant="outline" size="sm" className="max-sm:h-10" onClick={() => void downloadImportTemplate()}>
            <Download aria-hidden strokeWidth={1.8} />
            {t("inventory.import.template")}
          </Button>
        </div>
        <Input
          id={`${id}-file`}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={pending || !!done}
          onChange={onFile}
          className="max-sm:h-10"
          aria-invalid={fileError ? true : undefined}
          aria-describedby={`${id}-file-help${fileError ? ` ${id}-file-error` : ""}`}
        />
        <p id={`${id}-file-help`} className="text-(length:--fs-sm) text-(--text-3)">
          {t("inventory.import.fileHelp")}
        </p>
        {fileError && (
          <p id={`${id}-file-error`} role="alert" className="text-(length:--fs-sm) text-(--red)">
            {fileError}
          </p>
        )}
        {reading && (
          <p role="status" className="text-(length:--fs-sm) text-(--text-2)">
            {t("inventory.import.reading")}
          </p>
        )}
      </div>

      {rows && !done && (
        <p role="status" className="rounded-(--r-sm) bg-muted px-3 py-2 text-(length:--fs-sm) text-(--text-2) tabular-nums">
          {t("inventory.import.summary", { count: rows.length })}
        </p>
      )}

      {errors.length > 0 && !done && (
        <div className="grid gap-1.5">
          <p className="text-(length:--fs-sm) font-medium text-(--red)">
            {t("inventory.import.errorsTitle", { count: errors.length })}
          </p>
          <ul className="grid max-h-48 gap-1 overflow-y-auto text-(length:--fs-sm) text-(--red)">
            {errors.slice(0, MAX_SHOWN_ERRORS).map((er, i) => (
              <li key={i}>{t("inventory.import.errorRow", { row: er.row, reason: importReason(er.code, t) })}</li>
            ))}
          </ul>
          {errors.length > MAX_SHOWN_ERRORS && (
            <p className="text-(length:--fs-sm) text-(--text-3)">
              {t("inventory.import.more", { count: errors.length - MAX_SHOWN_ERRORS })}
            </p>
          )}
        </div>
      )}

      {done ? (
        <p role="status" className="rounded-(--r-sm) bg-muted px-3 py-2 text-(length:--fs-base) text-(--text-1) tabular-nums">
          {t("inventory.import.result", done)}
        </p>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`}>{t("inventory.import.note")}</Label>
          <Input
            id={`${id}-note`}
            autoComplete="off"
            maxLength={500}
            placeholder={t("inventory.import.notePlaceholder")}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(null);
            }}
            className="max-sm:h-10"
            aria-required
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${id}-note-error` : undefined}
          />
          {noteError && (
            <p id={`${id}-note-error`} className="text-(length:--fs-sm) text-(--red)">
              {noteError}
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" className="max-sm:h-10" onClick={onClose}>
          {done ? t("common.action.close") : t("common.action.cancel")}
        </Button>
        {!done && (
          <Button
            type="submit"
            className="max-sm:h-10"
            disabled={pending || reading || !rows || errors.length > 0}
            aria-busy={pending}
          >
            {pending ? t("common.action.saving") : t("inventory.import.submit")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
