"use client";
// 파일 화면 공용 부품. 형식 아이콘, 업로드 상태(진행률·실패·미완료), 행 동작(재시도·취소·⋯ 메뉴), 올리기 버튼·끌어 놓기 영역, 목록 한 줄
import {
  Download,
  Ellipsis,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  PenTool,
  RotateCcw,
  Trash,
  Unlink,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilesCtl, Transfer } from "@/components/files/use-files";
import { UPLOAD_UNFINISHED } from "@/lib/files/errors";
import { formatRelative } from "@/lib/format/date";
import { ACCEPT_ATTR, ALLOWED_EXT_LABEL, formatSize, MAX_FILE_LABEL, type FileType } from "@/lib/files/mime";
import type { FileItem } from "@/lib/files/types";
import { FILE_STATUS_LABELS } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<FileType, LucideIcon> = {
  fig: PenTool,
  pdf: FileText,
  zip: FileArchive,
  img: FileImage,
  sheet: FileSpreadsheet,
  doc: FileText,
  code: FileCode,
  other: File,
};

const TYPE_TONES: Record<FileType, string> = {
  fig: "text-(--violet)",
  pdf: "text-(--red)",
  zip: "text-(--amber)",
  img: "text-(--teal)",
  sheet: "text-(--green)",
  doc: "text-(--blue)",
  code: "text-(--text-2)",
  other: "text-(--text-3)",
};

const MENU_CLASS = "min-w-44 rounded-(--r) bg-(--surface) text-(--text) shadow-(--shadow-pop) ring-0";
const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

export function FileTypeIcon({ type, size = 16, className }: { type: FileType; size?: number; className?: string }) {
  const Icon = TYPE_ICONS[type];
  return <Icon aria-hidden size={size} strokeWidth={1.8} className={cn("shrink-0", TYPE_TONES[type], className)} />;
}

// 완료가 아닌 행의 상태. 이 브라우저의 전송이면 진행률, 실패면 사유, 그 밖의 pending은 미완료 안내
export function FileStatus({ item, transfer }: { item: FileItem; transfer?: Transfer }) {
  if (item.status === "ready") return null;
  if (transfer && !transfer.error && item.status === "pending") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div
          role="progressbar"
          aria-label={`${item.name} 업로드 진행률`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={transfer.pct}
          className="h-1 w-full min-w-16 overflow-hidden rounded-(--r-full) bg-(--surface-3)"
        >
          <div className="h-full rounded-(--r-full) bg-(--accent) transition-[width]" style={{ width: `${transfer.pct}%` }} />
        </div>
        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{transfer.pct}%</span>
      </div>
    );
  }
  if (item.status === "failed" || transfer?.error) {
    return (
      <p className="truncate text-(length:--fs-xs) text-(--red)" title={transfer?.error ?? UPLOAD_UNFINISHED}>
        {FILE_STATUS_LABELS.failed} · {transfer?.error ?? UPLOAD_UNFINISHED}
      </p>
    );
  }
  return <p className="truncate text-(length:--fs-xs) text-(--text-3)">{FILE_STATUS_LABELS.pending} · 아직 완료되지 않았습니다</p>;
}

// 행 동작. 업로드 중이면 취소, 실패(또는 끊긴 내 업로드)면 재시도, 완료면 ⋯ 메뉴의 다운로드·작업 연결
export function FileActions({
  item,
  transfer,
  ctl,
  canEdit,
  meId,
  onLinkRequest,
}: {
  item: FileItem;
  transfer?: Transfer;
  ctl: FilesCtl;
  canEdit: boolean;
  meId: string;
  // 프로젝트 파일 화면에서만 준다(작업 고르기 창을 연다)
  onLinkRequest?: (item: FileItem) => void;
}) {
  const uploading = !!transfer && !transfer.error && item.status === "pending";
  const ready = item.status === "ready";
  // 남이 올리는 중인 pending 행은 재시도하지 않는다
  const canRetry =
    canEdit && !uploading && (item.status === "failed" || (item.status === "pending" && item.uploaded_by === meId));
  const hasMenu = ready || (canEdit && !uploading);

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {uploading && (
        <Button variant="ghost" size="icon-xs" aria-label={`${item.name} 업로드 취소`} onClick={() => ctl.cancel(item.id)}>
          <X {...ICON} />
        </Button>
      )}
      {canRetry && (
        <Button variant="ghost" size="xs" onClick={() => void ctl.retry(item)} aria-label={`${item.name} 다시 올리기`}>
          <RotateCcw size={12} strokeWidth={1.8} aria-hidden />
          재시도
        </Button>
      )}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`${item.name} 동작`} data-file-menu={item.id}>
              <Ellipsis {...ICON} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CLASS}>
            {ready && (
              <DropdownMenuItem onSelect={() => void ctl.download(item)}>
                <Download {...ICON} />
                다운로드
              </DropdownMenuItem>
            )}
            {canEdit && onLinkRequest && (
              <DropdownMenuItem onSelect={() => onLinkRequest(item)}>
                <Link2 {...ICON} />
                {item.task_id ? "다른 작업에 연결" : "작업에 연결"}
              </DropdownMenuItem>
            )}
            {canEdit && onLinkRequest && item.task_id && (
              <DropdownMenuItem onSelect={() => void ctl.link(item, null)}>
                <Unlink {...ICON} />
                작업 연결 해제
              </DropdownMenuItem>
            )}
            {canEdit && (
              <>
                {(ready || onLinkRequest) && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onSelect={() => void ctl.remove(item)}>
                  <Trash {...ICON} />
                  삭제
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// 숨긴 파일 입력. 선택 뒤 값을 비워 같은 파일을 다시 고를 수 있게 한다
function HiddenFileInput({ inputRef, onFiles }: { inputRef: React.RefObject<HTMLInputElement | null>; onFiles: (files: File[]) => void }) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_ATTR}
      tabIndex={-1}
      aria-hidden
      className="hidden"
      onChange={(e) => {
        const list = e.target.files ? [...e.target.files] : [];
        e.target.value = "";
        if (list.length > 0) onFiles(list);
      }}
    />
  );
}

export function UploadButton({ onFiles, className }: { onFiles: (files: File[]) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" className={className} onClick={() => input.current?.click()}>
        <Upload size={14} strokeWidth={1.8} aria-hidden />
        올리기
      </Button>
      <HiddenFileInput inputRef={input} onFiles={onFiles} />
    </>
  );
}

// 끌어 놓기 영역 + 파일 선택. 여러 파일을 한 번에 받는다
export function DropZone({
  onFiles,
  label,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "flex w-full items-center gap-3 rounded-(--r) border border-dashed border-(--border-strong) text-left text-(length:--fs-sm) text-(--text-3) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent)",
          compact ? "px-3 py-3" : "px-(--s-4) py-(--s-5)",
          over && "border-(--accent) bg-(--accent-soft) text-(--text)",
        )}
      >
        <Upload aria-hidden size={compact ? 14 : 18} strokeWidth={1.8} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-(--text-2)">{label}</span>
          <span className="block text-(length:--fs-xs) text-(--text-4)">
            파일당 최대 {MAX_FILE_LABEL} · {ALLOWED_EXT_LABEL}
          </span>
        </span>
      </button>
      <HiddenFileInput inputRef={input} onFiles={onFiles} />
    </div>
  );
}

// 목록 한 줄. 이름(+ 연결 작업), 크기·올린 사람·올린 때 또는 업로드 상태, 동작
export function FileListRow({
  item,
  transfer,
  ctl,
  canEdit,
  meId,
  now,
  showTask = false,
  onLinkRequest,
}: {
  item: FileItem;
  transfer?: Transfer;
  ctl: FilesCtl;
  canEdit: boolean;
  meId: string;
  now: Date;
  showTask?: boolean;
  onLinkRequest?: (item: FileItem) => void;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-(--divider) px-3 py-2 last:border-b-0">
      <FileTypeIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-(length:--fs-sm) text-(--text)" title={item.name}>
            {item.name}
          </p>
          {showTask && item.task && (
            <span
              title={item.task.title}
              className="shrink-0 rounded-(--r-xs) bg-(--surface-2) px-1.5 font-mono text-(length:--fs-2xs) text-(--text-2)"
            >
              {item.task.key}
            </span>
          )}
        </div>
        {item.status === "ready" ? <FileMeta item={item} now={now} /> : <FileStatus item={item} transfer={transfer} />}
      </div>
      <FileActions
        item={item}
        transfer={transfer}
        ctl={ctl}
        canEdit={canEdit}
        meId={meId}
        onLinkRequest={onLinkRequest}
      />
    </li>
  );
}

export function FileMeta({ item, now }: { item: FileItem; now: Date }) {
  return (
    <p className="truncate text-(length:--fs-xs) text-(--text-3)">
      {formatSize(item.size_bytes)}
      {item.uploader && ` · ${item.uploader.name}`}
      {` · ${formatRelative(item.created_at, now)}`}
    </p>
  );
}
