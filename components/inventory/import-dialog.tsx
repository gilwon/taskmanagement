"use client";
// Lucian UX/UI Prompt #032 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#032
// 재고 엑셀 업로드 대화상자. 파일 선택 → 읽은 결과·형식 오류 확인 + 메모 → 업로드 순서로 진행한다. 형식 검사는 편의용이고 최종 판정은 서버·DB가 한다
import { Download } from "lucide-react";
import { useId, useRef, useState } from "react";
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
import "@/components/ui/lucian-upload.css";
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

// 원본 #032의 파일 크기 표기
function sizeLabel(b: number) {
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

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
  // 드롭 영역 아래 목록에 보이는 파일 한 줄
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [isOver, setIsOver] = useState(false);
  // 자식 요소를 넘나들 때 dragleave가 먼저 오므로 원본처럼 깊이를 센다
  const depth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // 파일 입력의 change와 드롭이 함께 쓴다. 검증은 그대로다
  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setPicked({ name: file.name, size: file.size });
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
  // 업로드 중이거나 끝난 뒤에는 드롭 영역을 잠근다
  const fileDisabled = pending || !!done;
  // 읽기 실패나 형식 오류가 있으면 파일 줄이 실패 상태가 된다. 업로드가 끝난 뒤에는 오류를 따지지 않는다
  const fileFailed = !!fileError || (errors.length > 0 && !done);
  const rowBusy = reading || pending;

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
        <div className={`ux u032${isOver && !fileDisabled ? " is-over" : ""}`}>
          <button
            type="button"
            id={`${id}-file`}
            className="u032-zone"
            disabled={fileDisabled}
            aria-label={t("inventory.import.file")}
            aria-describedby={`${id}-file-help${fileError ? ` ${id}-file-error` : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              depth.current++;
              setIsOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
              if (--depth.current <= 0) {
                depth.current = 0;
                setIsOver(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              depth.current = 0;
              setIsOver(false);
              // 여러 개를 놓아도 첫 파일 하나만 쓴다
              if (!fileDisabled) void onFile(e.dataTransfer.files[0]);
            }}
          >
            <svg className="u032-dash" aria-hidden="true">
              <rect width="100%" height="100%" rx="25" />
            </svg>
            <span className="u032-orb" aria-hidden="true">
              <svg viewBox="0 0 28 28">
                <path d="M8.5 20.5H7a5 5 0 0 1-.6-10 7 7 0 0 1 13.4-1.6A5.5 5.5 0 0 1 21 20.5h-1.5M14 13v10M10.5 16.5L14 13l3.5 3.5" />
              </svg>
            </span>
            <b>
              {t("inventory.import.drop.title")} <em>{t("inventory.import.drop.pick")}</em>
            </b>
            <small id={`${id}-file-help`}>{t("inventory.import.drop.hint")}</small>
          </button>
          <input
            ref={inputRef}
            className="u032-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            tabIndex={-1}
            aria-hidden="true"
            disabled={fileDisabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // 같은 파일을 다시 골라도 change가 오도록 비운다
              e.target.value = "";
              void onFile(file);
            }}
          />
          <ul className="u032-list" aria-live="polite">
            {picked && (
              <li className={`u032-row${fileFailed ? " fail" : rowBusy ? "" : " done"}`}>
                <span className="u032-ic" style={{ "--c": "#22A06B" } as React.CSSProperties} aria-hidden="true">
                  XLSX
                </span>
                <span className="u032-meta">
                  <b>{picked.name}</b>
                  <small>
                    {fileFailed
                      ? (fileError ?? t("inventory.import.errorsTitle", { count: errors.length }))
                      : `${sizeLabel(picked.size)} · ${t(rowBusy ? "inventory.import.drop.reading" : "inventory.import.drop.ready")}`}
                  </small>
                </span>
                {fileFailed ? (
                  <button type="button" className="u032-retry" disabled={fileDisabled} onClick={() => inputRef.current?.click()}>
                    {t("inventory.import.drop.retry")}
                  </button>
                ) : (
                  <span className="u032-st">
                    {rowBusy ? (
                      <span className="u032-spin" aria-hidden="true" />
                    ) : (
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3.5 8.4l3 3 6-6.4" />
                      </svg>
                    )}
                  </span>
                )}
              </li>
            )}
          </ul>
        </div>
        {fileError && (
          <p id={`${id}-file-error`} role="alert" className="text-(length:--fs-sm) text-(--red)">
            {fileError}
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
