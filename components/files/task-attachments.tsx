"use client";
// 작업 드로어 첨부 파일 섹션. 첨부 목록을 직접 읽고, 끌어 놓기·선택 업로드(진행률), 실패 재시도, 다운로드, 삭제(실행 취소)를 제공한다
import { useEffect, useState } from "react";
import { DropZone, FileListRow, UploadButton } from "@/components/files/file-parts";
import { useFiles } from "@/components/files/use-files";
import { Button } from "@/components/ui/button";
import { listTaskFiles } from "@/lib/files/actions";
import type { FileItem } from "@/lib/files/types";
import { useT } from "@/lib/i18n/client";

type Loaded = { files: FileItem[]; canEdit: boolean; canManage: boolean; meId: string };
type LoadState = { taskId: string; data: Loaded } | { taskId: string; error: string };

export function TaskAttachments({
  projectId,
  taskId,
  canEdit,
  onCountChange,
}: {
  // 드로어가 넘기는 값과 맞춘 자리. 지금은 projectId·taskId만으로 충분해 쓰지 않는다
  workspaceId: string;
  projectId: string;
  taskId: string;
  // 넘기지 않으면 서버의 can_edit_project 결과를 쓴다. false면 업로드·삭제를 숨긴다(최종 판정은 RLS)
  canEdit?: boolean;
  // 완료(ready) 파일 수가 바뀔 때. 작업 카드의 첨부 수 갱신용
  onCountChange?: (count: number) => void;
}) {
  const t = useT();
  // 다른 작업으로 바뀌면 이전 작업의 결과를 쓰지 않도록 taskId와 함께 둔다
  const [state, setState] = useState<LoadState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    listTaskFiles(taskId)
      .catch(() => ({ ok: false as const, error: t("tasks.errors.network") }))
      .then((r) => {
        if (!alive) return;
        setState(r.ok ? { taskId, data: r.data } : { taskId, error: r.error });
      });
    return () => {
      alive = false;
    };
  }, [taskId, attempt, t]);

  const headingId = `attachments-${taskId}`;
  const current = state?.taskId === taskId ? state : null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      {current && "data" in current ? (
        <AttachmentList
          key={taskId}
          headingId={headingId}
          projectId={projectId}
          taskId={taskId}
          data={current.data}
          canEdit={canEdit === false ? false : current.data.canEdit}
          onCountChange={onCountChange}
        />
      ) : (
        <>
          <h3 id={headingId} className="text-(length:--fs-sm) font-semibold text-(--text)">
            {t("files.attachments")}
          </h3>
          {current ? (
            <div role="alert" className="flex items-center gap-2 text-(length:--fs-sm) text-(--red)">
              {current.error}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setState(null);
                  setAttempt((n) => n + 1);
                }}
              >
                {t("common.action.retry")}
              </Button>
            </div>
          ) : (
            <p aria-busy="true" className="text-(length:--fs-sm) text-(--text-3)">
              {t("files.attachmentsLoading")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AttachmentList({
  headingId,
  projectId,
  taskId,
  data,
  canEdit,
  onCountChange,
}: {
  headingId: string;
  projectId: string;
  taskId: string;
  data: Loaded;
  canEdit: boolean;
  onCountChange?: (count: number) => void;
}) {
  const t = useT();
  const ctl = useFiles({ projectId, taskId, initial: data.files });
  const readyCount = ctl.files.filter((f) => f.status === "ready").length;
  const [now] = useState(() => new Date());

  useEffect(() => {
    onCountChange?.(readyCount);
  }, [readyCount, onCountChange]);

  return (
    <>
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-(length:--fs-sm) font-semibold text-(--text)">
          {t("files.attachments")}
        </h3>
        <span className="font-mono text-(length:--fs-xs) text-(--text-3)">{readyCount}</span>
        {canEdit && <UploadButton className="ml-auto" onFiles={(f) => void ctl.upload(f)} />}
      </div>
      {ctl.files.length > 0 && (
        <ul aria-label={t("files.attachmentsList")} className="rounded-(--r) border border-(--border)">
          {ctl.files.map((item) => (
            <FileListRow
              key={item.id}
              item={item}
              transfer={ctl.transfers[item.id]}
              ctl={ctl}
              canEdit={canEdit}
              canManage={data.canManage}
              meId={data.meId}
              now={now}
            />
          ))}
        </ul>
      )}
      {canEdit ? (
        <DropZone compact label={t("files.attachHere")} onFiles={(f) => void ctl.upload(f)} />
      ) : (
        ctl.files.length === 0 && <p className="text-(length:--fs-sm) text-(--text-3)">{t("files.noAttachments")}</p>
      )}
    </>
  );
}
