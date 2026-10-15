"use client";
// 파일 목록 상태와 업로드·재시도·취소·삭제·복원·다운로드·작업 연결을 묶은 훅. 프로젝트 파일 화면과 드로어 첨부가 같이 쓴다.
// 파일 본문은 서버 액션이 준 서명 URL로 브라우저가 Storage에 직접 PUT한다(진행률 때문에 XHR)
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { setTransfer, uploadBlobs, uploadXhrs, useTransfers, type Transfer } from "@/components/files/upload-store";
import { announce } from "@/components/tasks/views/shared";
import {
  deleteFile,
  failUpload,
  fileDownloadUrl,
  finalizeUpload,
  linkFileTask,
  prepareUpload,
  restoreFile,
  retryUpload,
} from "@/lib/files/actions";
import { storageUploadMessage, UPLOAD_CANCELED } from "@/lib/files/errors";
import { ACCEPT_ATTR, checkUpload, extOf } from "@/lib/files/mime";
import type { FileItem, UploadTicket } from "@/lib/files/types";
import { NETWORK_ERROR } from "@/lib/tasks/errors";

const byNewest = (a: FileItem, b: FileItem) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);

// 실패한 행을 새로고침 뒤 다시 올릴 때 파일을 다시 고른다
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT_ATTR;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function markFailed(id: string, name: string, message: string) {
  setTransfer(id, { pct: 0, error: message });
  toast.error(`${name} 업로드 실패. ${message}`);
  announce(`${name} 업로드 실패. ${message}`);
}

// 서명 URL로 PUT. 성공하면 finalize, 실패·취소면 행을 failed로 돌린다.
// 컴포넌트가 사라져도(드로어 닫힘) 계속 돌고 결과는 upload-store에만 남긴다
function startTransfer(ticket: UploadTicket, blob: File) {
  const { file } = ticket;
  uploadBlobs.set(file.id, blob);
  setTransfer(file.id, { pct: 0 });

  const xhr = new XMLHttpRequest();
  uploadXhrs.set(file.id, xhr);
  let last = 0;
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.min(99, Math.floor((e.loaded / e.total) * 100));
    // 1% 단위로만 다시 그린다
    if (pct !== last) setTransfer(file.id, { pct: (last = pct) });
  };
  // 네트워크가 끊겨 실패 기록도 못 하면 행은 pending으로 남는다. 재시도가 failed로 돌린 뒤 다시 올린다
  const recordFail = () => failUpload(file.id).catch(() => undefined);
  xhr.onload = async () => {
    uploadXhrs.delete(file.id);
    if (xhr.status < 200 || xhr.status >= 300) {
      markFailed(file.id, file.name, storageUploadMessage(xhr.status, xhr.responseText));
      return void recordFail();
    }
    setTransfer(file.id, { pct: 100 });
    // 실패하면 서버 액션이 행을 failed로 돌린다
    const r = await finalizeUpload(file.id).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
    if (!r.ok) return markFailed(file.id, file.name, r.error);
    uploadBlobs.delete(file.id);
    setTransfer(file.id, { pct: 100, done: true });
    announce(`${file.name} 업로드를 마쳤습니다.`);
  };
  xhr.onerror = () => {
    uploadXhrs.delete(file.id);
    markFailed(file.id, file.name, NETWORK_ERROR);
    void recordFail();
  };
  // 사용자가 고른 취소라 실패 토스트 대신 안내만 한다
  xhr.onabort = () => {
    uploadXhrs.delete(file.id);
    setTransfer(file.id, { pct: 0, error: UPLOAD_CANCELED, canceled: true });
    toast.info(UPLOAD_CANCELED, { description: file.name });
    announce(`${UPLOAD_CANCELED} ${file.name}`);
    void recordFail();
  };
  xhr.open("PUT", ticket.url);
  // 버킷과 finalize_file이 MIME을 검사하므로 브라우저 File.type이 아니라 서버가 확장자로 정한 값을 보낸다
  xhr.setRequestHeader("content-type", ticket.mime);
  xhr.setRequestHeader("cache-control", "max-age=3600");
  xhr.send(blob);
}

// 저장소의 전송 결과를 행 상태에 덮는다. ready까지 끝났으면 ready, 실패·취소면 failed
function withTransfer(f: FileItem, t: Transfer | undefined): FileItem {
  if (!t || f.status === "ready") return f;
  if (t.done) return { ...f, status: "ready" };
  if (t.error) return { ...f, status: "failed" };
  return f;
}

export function useFiles({
  projectId,
  taskId,
  initial,
}: {
  projectId: string;
  // 드로어 첨부면 작업 id. 올린 파일이 그 작업에 연결된다
  taskId: string | null;
  initial: FileItem[];
}) {
  const [rows, setRows] = useState<FileItem[]>(initial);
  const transfers = useTransfers();
  const files = useMemo(() => rows.map((f) => withTransfer(f, transfers[f.id])), [rows, transfers]);

  const upsert = useCallback((item: FileItem) => {
    setRows((list) => [item, ...list.filter((f) => f.id !== item.id)].sort(byNewest));
  }, []);

  const send = useCallback(
    (ticket: UploadTicket, blob: File) => {
      upsert({ ...ticket.file, status: "pending" });
      startTransfer(ticket, blob);
    },
    [upsert],
  );

  const upload = useCallback(
    async (list: Iterable<File>) => {
      for (const blob of list) {
        // 서버도 같은 검사를 다시 하지만 형식·크기 위반은 여기서 바로 알린다
        const check = checkUpload(blob.name, blob.size);
        if (!check.ok) {
          toast.error(check.error);
          announce(check.error);
          continue;
        }
        const r = await prepareUpload(projectId, taskId, blob.name, blob.size).catch(() => ({
          ok: false as const,
          error: NETWORK_ERROR,
        }));
        if (!r.ok) {
          toast.error(`${check.name} 업로드 실패. ${r.error}`);
          announce(`${check.name} 업로드 실패. ${r.error}`);
          continue;
        }
        send(r.data, blob);
      }
    },
    [projectId, taskId, send],
  );

  const retry = useCallback(
    async (item: FileItem) => {
      let blob = uploadBlobs.get(item.id) ?? null;
      if (!blob) {
        blob = await pickFile();
        if (!blob) return;
        // finalize가 크기를 확인하므로 처음과 같은 파일이어야 한다
        if (blob.size !== item.size_bytes || extOf(blob.name) !== extOf(item.name)) {
          return void toast.error(`처음 올린 것과 같은 파일(${item.name})을 골라 주세요.`);
        }
      }
      const r = await retryUpload(item.id).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
      if (!r.ok) return void toast.error(r.error);
      send(r.data, blob);
    },
    [send],
  );

  const cancel = useCallback((id: string) => uploadXhrs.get(id)?.abort(), []);

  // 소프트 삭제. 토스트의 실행 취소는 받은 토큰을 그대로 넘긴다
  const remove = useCallback(
    async (item: FileItem) => {
      const r = await deleteFile(item.id).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
      if (!r.ok) return void toast.error(r.error);
      setRows((list) => list.filter((f) => f.id !== item.id));
      setTransfer(item.id, null);
      uploadBlobs.delete(item.id);
      announce(`파일을 삭제했습니다. ${item.name}`);
      toast("파일을 삭제했습니다", {
        description: item.name,
        action: {
          label: "실행 취소",
          onClick: async () => {
            const back = await restoreFile(item.id, r.data.token).catch(() => ({
              ok: false as const,
              error: NETWORK_ERROR,
            }));
            if (!back.ok) return void toast.error(back.error);
            upsert(back.data);
            toast.success("파일을 되돌렸습니다", { description: item.name });
          },
        },
      });
    },
    [upsert],
  );

  const download = useCallback(async (item: FileItem) => {
    const r = await fileDownloadUrl(item.id).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
    if (!r.ok) return void toast.error(r.error);
    // 서명 URL 응답이 Content-Disposition: attachment라 페이지를 떠나지 않고 내려받는다
    const a = document.createElement("a");
    a.href = r.data;
    a.rel = "noopener";
    a.click();
  }, []);

  const link = useCallback(
    async (item: FileItem, taskId: string | null) => {
      const r = await linkFileTask(item.id, taskId).catch(() => ({ ok: false as const, error: NETWORK_ERROR }));
      if (!r.ok) return void toast.error(r.error);
      upsert(r.data);
      const msg = r.data.task ? `${r.data.task.key}에 연결했습니다. ${item.name}` : `작업 연결을 해제했습니다. ${item.name}`;
      toast.success(msg);
      announce(msg);
    },
    [upsert],
  );

  return { files, transfers, upload, retry, cancel, remove, download, link };
}

export type FilesCtl = ReturnType<typeof useFiles>;
