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
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import type { Transfer } from "@/components/files/upload-store";
import type { FilesCtl } from "@/components/files/use-files";
import { KeyContextMenu, type MenuItemComponent } from "@/components/shortcuts/key-context-menu";
import { ACCEPT_ATTR, ALLOWED_EXT_LABEL, formatSize, MAX_FILE_LABEL, type FileType } from "@/lib/files/mime";
import type { FileItem } from "@/lib/files/types";
import { useFormatter, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import "@/components/files/lucian-files.css";

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

export const MENU_CLASS = "min-w-44 rounded-(--r) bg-(--surface) text-(--text) shadow-(--shadow-pop) ring-0";
export const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

export function FileTypeIcon({ type, size = 16, className }: { type: FileType; size?: number; className?: string }) {
  const Icon = TYPE_ICONS[type];
  return <Icon aria-hidden size={size} strokeWidth={1.8} className={cn("shrink-0", TYPE_TONES[type], className)} />;
}

// 행의 업로드 단계. active는 이 탭에서 전송 중, stalled는 이 탭 저장소에 없는 내 pending(중단됨),
// remote는 남이 올리는 중인 pending
type Phase = "ready" | "active" | "failed" | "stalled" | "remote";

function phaseOf(item: FileItem, transfer: Transfer | undefined, meId: string): Phase {
  if (item.status === "ready") return "ready";
  if (item.status === "failed") return "failed";
  if (transfer && !transfer.error && !transfer.done) return "active";
  return item.uploaded_by === meId ? "stalled" : "remote";
}

// 완료가 아닌 행의 상태. 전송 중이면 진행률, 실패면 사유, 중단된 내 업로드·남의 업로드는 안내
export function FileStatus({ item, transfer, meId }: { item: FileItem; transfer?: Transfer; meId: string }) {
  const t = useT();
  const phase = phaseOf(item, transfer, meId);
  if (phase === "ready") return null;
  if (phase === "active" && transfer) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div
          role="progressbar"
          aria-label={t("files.progress", { name: item.name })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={transfer.pct}
          className="h-1 w-full min-w-16 overflow-hidden rounded-(--r-full) bg-(--surface-3)"
        >
          <div className="u032-bar" style={{ "--p": transfer.pct / 100 } as React.CSSProperties} />
        </div>
        <span className="shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{transfer.pct}%</span>
      </div>
    );
  }
  if (phase === "failed") {
    const reason = transfer?.error ?? t("files.errors.uploadUnfinished");
    return (
      <p className={cn("truncate text-(length:--fs-xs)", transfer?.canceled ? "text-(--text-3)" : "text-(--red)")} title={reason}>
        {transfer?.canceled ? reason : `${t("common.fileStatus.failed")} · ${reason}`}
      </p>
    );
  }
  if (phase === "stalled") {
    return <p className="truncate text-(length:--fs-xs) text-(--red)">{t("files.stalled")}</p>;
  }
  return <p className="truncate text-(length:--fs-xs) text-(--text-3)">{t("common.fileStatus.pending")} {t("files.notFinished")}</p>;
}

// 행 동작. 전송 중이면 취소(완료 확인 대기 중에는 숨김), 실패·중단된 행은 재시도, ⋯ 메뉴의 다운로드·작업 연결·삭제
export function FileActions({
  item,
  transfer,
  ctl,
  canEdit,
  canManage,
  meId,
  onLinkRequest,
}: {
  item: FileItem;
  transfer?: Transfer;
  ctl: FilesCtl;
  canEdit: boolean;
  // 남이 올리다 실패한 행의 재시도(retry_file은 업로더 본인 또는 can_manage_project만 받는다)
  canManage: boolean;
  meId: string;
  // 프로젝트 파일 화면에서만 준다(작업 고르기 창을 연다)
  onLinkRequest?: (item: FileItem) => void;
}) {
  const t = useT();
  const phase = phaseOf(item, transfer, meId);
  const ready = phase === "ready";
  const canRetry =
    canEdit && (phase === "stalled" || (phase === "failed" && (item.uploaded_by === meId || canManage)));
  const hasMenu = ready || (canEdit && phase !== "active");

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {phase === "active" && transfer && transfer.pct < 100 && (
        <Button variant="ghost" size="icon-xs" aria-label={t("files.cancelUpload", { name: item.name })} onClick={() => ctl.cancel(item.id)}>
          <X {...ICON} />
        </Button>
      )}
      {canRetry && (
        <Button variant="ghost" size="xs" onClick={() => void ctl.retry(item)} aria-label={t("files.reupload", { name: item.name })}>
          <RotateCcw size={12} strokeWidth={1.8} aria-hidden />
          {t("files.retry")}
        </Button>
      )}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t("files.actions", { name: item.name })} data-file-menu={item.id}>
              <Ellipsis {...ICON} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={MENU_CLASS}>
            <FileMenuItems
              Item={DropdownMenuItem}
              Separator={DropdownMenuSeparator}
              item={item}
              ready={ready}
              canEdit={canEdit}
              ctl={ctl}
              onLinkRequest={onLinkRequest}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// 파일 메뉴 항목. ⋯ 메뉴(DropdownMenu)와 행·카드 우클릭 메뉴(ContextMenu)가 같이 쓴다
function FileMenuItems({
  Item,
  Separator,
  item,
  ready,
  canEdit,
  ctl,
  onLinkRequest,
}: {
  Item: MenuItemComponent;
  Separator: React.ComponentType;
  item: FileItem;
  ready: boolean;
  canEdit: boolean;
  ctl: FilesCtl;
  onLinkRequest?: (item: FileItem) => void;
}) {
  const t = useT();
  return (
    <>
      {ready && (
        <Item onSelect={() => void ctl.download(item)}>
          <Download {...ICON} />
          {t("files.download")}
        </Item>
      )}
      {canEdit && onLinkRequest && (
        <Item onSelect={() => onLinkRequest(item)}>
          <Link2 {...ICON} />
          {item.task_id ? t("files.linkOther") : t("files.link")}
        </Item>
      )}
      {canEdit && onLinkRequest && item.task_id && (
        <Item onSelect={() => void ctl.link(item, null)}>
          <Unlink {...ICON} />
          {t("files.unlink")}
        </Item>
      )}
      {canEdit && (
        <>
          {(ready || onLinkRequest) && <Separator />}
          <Item variant="destructive" onSelect={() => void ctl.remove(item)}>
            <Trash {...ICON} />
            {t("files.delete")}
          </Item>
        </>
      )}
    </>
  );
}

// 파일 행·카드 우클릭 메뉴. ⋯ 메뉴가 있을 때만 같은 항목으로 연다
export function FileContextMenu({
  item,
  transfer,
  ctl,
  canEdit,
  meId,
  onLinkRequest,
  children,
}: {
  item: FileItem;
  transfer?: Transfer;
  ctl: FilesCtl;
  canEdit: boolean;
  meId: string;
  onLinkRequest?: (item: FileItem) => void;
  children: React.ReactElement;
}) {
  const t = useT();
  const phase = phaseOf(item, transfer, meId);
  const ready = phase === "ready";
  if (!(ready || (canEdit && phase !== "active"))) return children;
  return (
    <KeyContextMenu
      label={t("files.menu", { name: item.name })}
      className={MENU_CLASS}
      menu={
        <FileMenuItems
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
          item={item}
          ready={ready}
          canEdit={canEdit}
          ctl={ctl}
          onLinkRequest={onLinkRequest}
        />
      }
    >
      {children}
    </KeyContextMenu>
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
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" className={className} onClick={() => input.current?.click()}>
        <Upload size={14} strokeWidth={1.8} aria-hidden />
        {t("files.upload")}
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
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      // 영역 안의 아이콘·글자로 옮겨 갈 때도 dragleave가 와서 강조가 깜빡이므로, 옮겨 간 곳이 영역 안이면 무시한다
      onDragLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      }}
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
        data-compact={compact || undefined}
        className={cn(
          "u032-zone flex w-full items-center gap-3 rounded-(--r) text-left text-(length:--fs-sm) text-(--text-3) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
          compact ? "px-3 py-3" : "px-(--s-4) py-(--s-5)",
          over && "is-over",
        )}
      >
        {/* 점선 테두리(#032). rx는 --r(12px)에서 선 두께 절반을 뺀 값이다 */}
        <svg aria-hidden className="u032-dash">
          <rect width="100%" height="100%" rx="11" />
        </svg>
        <span aria-hidden className="u032-orb">
          <Upload size={compact ? 14 : 18} strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block text-(--text-2)">{label}</span>
          <span className="block text-(length:--fs-xs) text-(--text-4)">
            {t("files.limit", { max: MAX_FILE_LABEL, exts: ALLOWED_EXT_LABEL })}
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
  canManage,
  meId,
  now,
  showTask = false,
  onLinkRequest,
}: {
  item: FileItem;
  transfer?: Transfer;
  ctl: FilesCtl;
  canEdit: boolean;
  canManage: boolean;
  meId: string;
  now: Date;
  showTask?: boolean;
  onLinkRequest?: (item: FileItem) => void;
}) {
  return (
    <FileContextMenu
      item={item}
      transfer={transfer}
      ctl={ctl}
      canEdit={canEdit}
      meId={meId}
      onLinkRequest={onLinkRequest}
    >
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
          {item.status === "ready" ? (
            <FileMeta item={item} now={now} />
          ) : (
            <FileStatus item={item} transfer={transfer} meId={meId} />
          )}
        </div>
        <UploadCheck done={item.status === "ready" && !!transfer?.done} />
        <FileActions
          item={item}
          transfer={transfer}
          ctl={ctl}
          canEdit={canEdit}
          canManage={canManage}
          meId={meId}
          onLinkRequest={onLinkRequest}
        />
      </li>
    </FileContextMenu>
  );
}

// 완료 체크(#032). 이 탭에서 끝까지 올린 파일에 붙는다. 처음 그릴 때 이미 끝나 있던 것은 가만히 두고, 그린 뒤에 끝난 것만 튄다
function UploadCheck({ done }: { done: boolean }) {
  const [prev, setPrev] = useState(done);
  const [fresh, setFresh] = useState(false);
  if (prev !== done) {
    setPrev(done);
    setFresh(done);
  }
  if (!done) return null;
  return (
    <span aria-hidden className={cn("u032-st", fresh && "is-new")}>
      <svg viewBox="0 0 16 16">
        <path d="M3.5 8.4l3 3 6-6.4" />
      </svg>
    </span>
  );
}

export function FileMeta({ item, now }: { item: FileItem; now: Date }) {
  const f = useFormatter();
  return (
    <p className="truncate text-(length:--fs-xs) text-(--text-3)">
      {formatSize(item.size_bytes)}
      {item.uploader && ` · ${item.uploader.name}`}
      {` · ${f.relative(item.created_at, now)}`}
    </p>
  );
}
