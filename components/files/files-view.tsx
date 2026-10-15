"use client";
// 프로젝트 파일 화면 본문. 검색·형식 필터·정렬·목록/격자 전환, 끌어 놓기·선택 업로드(여러 파일 동시, 진행률), 행 메뉴(다운로드·작업 연결·삭제)
import { ArrowDownWideNarrow, FolderOpen, ListFilter, Search, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DropZone, FileActions, FileListRow, FileMeta, FileStatus, FileTypeIcon, UploadButton } from "@/components/files/file-parts";
import { useFiles, type FilesCtl, type Transfer } from "@/components/files/use-files";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { previewUrls } from "@/lib/files/actions";
import type { FileType } from "@/lib/files/mime";
import type { FileItem, LinkableTask } from "@/lib/files/types";
import { FILE_SORT_LABELS, FILE_TYPE_LABELS, FILE_VIEW_LABELS } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

type SortKey = keyof typeof FILE_SORT_LABELS;
type ViewMode = keyof typeof FILE_VIEW_LABELS;
type TypeFilter = FileType | "all";

const TOOLBAR_BTN =
  "h-(--h-sm) gap-1.5 rounded-(--r-sm) px-2 text-(length:--fs-sm) font-normal text-(--text-2) hover:bg-(--surface-2) hover:text-(--text) aria-expanded:bg-(--surface-2)";
const MENU_CLASS = "min-w-44 rounded-(--r) bg-(--surface) text-(--text) shadow-(--shadow-pop) ring-0";
const ICON = { size: 14, strokeWidth: 1.8, "aria-hidden": true } as const;

const SORTERS: Record<SortKey, (a: FileItem, b: FileItem) => number> = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  name: (a, b) => a.name.localeCompare(b.name, "ko"),
  type: (a, b) => FILE_TYPE_LABELS[a.type].localeCompare(FILE_TYPE_LABELS[b.type], "ko") || a.name.localeCompare(b.name, "ko"),
  size: (a, b) => b.size_bytes - a.size_bytes,
};

export function FilesView({
  projectId,
  canEdit,
  meId,
  nowIso,
  initialFiles,
  tasks,
}: {
  projectId: string;
  canEdit: boolean;
  meId: string;
  nowIso: string;
  initialFiles: FileItem[];
  tasks: LinkableTask[];
}) {
  const ctl = useFiles({ projectId, taskId: null, initial: initialFiles });
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [mode, setMode] = useState<ViewMode>("list");
  const [linking, setLinking] = useState<FileItem | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const previews = usePreviews(mode === "grid" ? ctl.files : []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ctl.files
      .filter((f) => (type === "all" || f.type === type) && (!needle || f.name.toLowerCase().includes(needle)))
      .sort(SORTERS[sort]);
  }, [ctl.files, q, type, sort]);

  const upload = (list: File[]) => void ctl.upload(list);
  // 창을 연 메뉴 항목은 닫히며 사라지므로 그 파일의 ⋯ 버튼으로 포커스를 돌려준다
  const closeLink = () => {
    const id = linking?.id;
    setLinking(null);
    if (id) setTimeout(() => document.querySelector<HTMLElement>(`[data-file-menu="${id}"]`)?.focus(), 0);
  };
  const rowProps = { ctl, canEdit, meId, onLinkRequest: setLinking };

  return (
    <div className="flex flex-col gap-(--s-3) pt-(--s-3) pb-(--s-6)">
      <div role="toolbar" aria-label="파일 보기 설정" className="mx-(--gutter) flex flex-wrap items-center gap-(--s-1)">
        <div className="relative flex items-center">
          <Search {...ICON} className="pointer-events-none absolute left-2 text-(--text-4)" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && q) {
                e.preventDefault();
                setQ("");
              }
            }}
            placeholder="파일 검색"
            aria-label="파일 검색"
            className="h-(--h-sm) w-48 rounded-(--r-sm) border border-(--border) bg-(--surface) pr-2 pl-7 text-(length:--fs-sm) text-(--text) placeholder:text-(--text-4) focus-visible:border-(--accent-line) focus-visible:outline-none max-sm:w-36 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={TOOLBAR_BTN}>
              <ListFilter {...ICON} />
              형식: {type === "all" ? "전체" : FILE_TYPE_LABELS[type]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CLASS}>
            <DropdownMenuLabel>파일 형식</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={type} onValueChange={(v) => setType(v as TypeFilter)}>
              <DropdownMenuRadioItem value="all">전체</DropdownMenuRadioItem>
              {(Object.keys(FILE_TYPE_LABELS) as FileType[]).map((t) => (
                <DropdownMenuRadioItem key={t} value={t}>
                  {FILE_TYPE_LABELS[t]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={TOOLBAR_BTN}>
              <ArrowDownWideNarrow {...ICON} />
              정렬: {FILE_SORT_LABELS[sort]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CLASS}>
            <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              {(Object.keys(FILE_SORT_LABELS) as SortKey[]).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {FILE_SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-(--s-1)">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={mode}
            aria-label="보기 방식"
            onValueChange={(v) => v && setMode(v as ViewMode)}
          >
            {(Object.keys(FILE_VIEW_LABELS) as ViewMode[]).map((m) => (
              <ToggleGroupItem key={m} value={m} className="h-(--h-md) px-2.5 text-(length:--fs-sm)">
                {FILE_VIEW_LABELS[m]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {canEdit && <UploadButton onFiles={upload} />}
        </div>
      </div>

      {canEdit && (
        <div className="mx-(--gutter)">
          <DropZone label="파일을 끌어 놓거나 클릭해 올리세요" onFiles={upload} />
        </div>
      )}

      {ctl.files.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="아직 파일이 없습니다"
          description={canEdit ? "파일을 끌어 놓거나 올리기 버튼으로 추가하세요." : undefined}
        />
      ) : shown.length === 0 ? (
        <EmptyState icon={SearchX} title="검색 결과가 없습니다" description="조건에 맞는 파일이 없습니다." />
      ) : mode === "list" ? (
        <ul aria-label="파일 목록" className="mx-(--gutter) rounded-(--r) border border-(--border) bg-(--surface)">
          {shown.map((item) => (
            <FileListRow key={item.id} item={item} transfer={ctl.transfers[item.id]} now={now} showTask {...rowProps} />
          ))}
        </ul>
      ) : (
        <ul aria-label="파일 목록" className="mx-(--gutter) grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-(--s-3)">
          {shown.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              transfer={ctl.transfers[item.id]}
              preview={previews[item.id]}
              now={now}
              {...rowProps}
            />
          ))}
        </ul>
      )}

      <LinkTaskDialog
        item={linking}
        tasks={tasks}
        onClose={() => closeLink()}
        onPick={(taskId) => {
          if (linking) void ctl.link(linking, taskId);
          closeLink();
        }}
      />
    </div>
  );
}

function FileCard({
  item,
  transfer,
  preview,
  now,
  ctl,
  canEdit,
  meId,
  onLinkRequest,
}: {
  item: FileItem;
  transfer?: Transfer;
  preview?: string;
  now: Date;
  ctl: FilesCtl;
  canEdit: boolean;
  meId: string;
  onLinkRequest: (item: FileItem) => void;
}) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-(--r) border border-(--border) bg-(--surface)">
      <div className="flex aspect-[4/3] items-center justify-center bg-(--surface-2)">
        {preview ? (
          // 서명 URL(60초)이라 next/image 최적화 캐시에 넣지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <FileTypeIcon type={item.type} size={28} />
        )}
      </div>
      <div className="flex min-w-0 items-start gap-1 p-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-(length:--fs-sm) text-(--text)" title={item.name}>
            {item.name}
          </p>
          {item.task && (
            <p className="truncate font-mono text-(length:--fs-2xs) text-(--text-3)" title={item.task.title}>
              {item.task.key}
            </p>
          )}
          {item.status === "ready" ? <FileMeta item={item} now={now} /> : <FileStatus item={item} transfer={transfer} />}
        </div>
        <FileActions item={item} transfer={transfer} ctl={ctl} canEdit={canEdit} meId={meId} onLinkRequest={onLinkRequest} />
      </div>
    </li>
  );
}

// 격자 보기의 이미지 미리보기 서명 URL. 보이는 완료 이미지 중 아직 받지 않은 것만 한 번에 요청한다
function usePreviews(files: FileItem[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const ids = files.filter((f) => f.type === "img" && f.status === "ready" && !asked.current.has(f.id)).map((f) => f.id);
    if (ids.length === 0) return;
    ids.forEach((id) => asked.current.add(id));
    previewUrls(ids)
      .then((r) => {
        if (r.ok) setUrls((m) => ({ ...m, ...r.data }));
      })
      // 미리보기는 없어도 형식 아이콘으로 보인다
      .catch(() => undefined);
  }, [files]);
  return urls;
}

function LinkTaskDialog({
  item,
  tasks,
  onClose,
  onPick,
}: {
  item: FileItem | null;
  tasks: LinkableTask[];
  onClose: () => void;
  onPick: (taskId: string) => void;
}) {
  return (
    <CommandDialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title="작업에 연결"
      description={item ? `${item.name} 파일을 연결할 작업을 고르세요` : "연결할 작업을 고르세요"}
    >
      <Command>
        <CommandInput placeholder="작업 키나 제목으로 검색" />
        <CommandList>
          <CommandEmpty>일치하는 작업이 없습니다.</CommandEmpty>
          <CommandGroup heading="작업">
            {tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`${t.key} ${t.title}`}
                onSelect={() => onPick(t.id)}
                className={cn(item?.task_id === t.id && "font-medium")}
              >
                <span className="shrink-0 font-mono text-(length:--fs-xs) text-(--text-3)">{t.key}</span>
                <span className="truncate">{t.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
