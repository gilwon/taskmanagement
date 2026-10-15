"use client";
// 새 프로젝트 대화상자. 이름·키 미리보기·아이콘·색·공개 범위·리드·설명을 받아 create_project로 만든다.
// 키는 DB가 이름 이니셜로 정하고 겹치면 X를 붙인다. ⌘/Ctrl+Enter로 제출한다
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon } from "@/components/shell/project-icon";
import {
  GENERAL_ACCESS_LABELS,
  NO_LEAD_LABEL,
  PROJECT_COLORS,
  PROJECT_ICON_LABELS,
  type ProjectColor,
  type ProjectIconName,
} from "@/lib/i18n/labels";
import { projectKeyPreview } from "@/lib/projects/stats";
import type { CreateProjectInput, ProjectAccess } from "@/lib/projects/types";
import type { WorkspaceMember } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const NO_LEAD = "none";

// 네이티브 라디오를 숨기고 라벨을 버튼처럼 그린다. 화살표 키 이동과 그룹 이름은 브라우저가 맡는다
const swatch =
  "relative inline-flex cursor-pointer items-center justify-center rounded-(--r-sm) border border-transparent has-checked:border-(--accent) has-checked:bg-(--accent-soft) has-focus-visible:ring-2 has-focus-visible:ring-(--accent) hover:bg-(--surface-2)";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  meId: string;
  // null이면 아직 불러오는 중
  members: WorkspaceMember[] | null;
  loadError: string | null;
  onRetry: () => void;
  finalFocus?: React.RefObject<HTMLElement | null>;
  // 실패하면 한국어 오류 문구를 돌려준다
  onCreate: (input: Omit<CreateProjectInput, "workspaceId">) => Promise<string | null>;
};

export function NewProjectDialog(props: Props) {
  const { open, onOpenChange, finalFocus } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          if (!finalFocus?.current) return;
          e.preventDefault();
          finalFocus.current.focus();
        }}
        className="gap-0 p-0 sm:max-w-[560px] data-open:animate-[modalIn_.2s_var(--ease)] max-[640px]:max-w-[calc(100%-1rem)]"
      >
        <DialogTitle className="border-b border-(--divider) px-4 py-3 text-(length:--fs-md) font-semibold text-(--text)">
          새 프로젝트
        </DialogTitle>
        <DialogDescription className="sr-only">프로젝트 이름과 표시 방식, 공개 범위를 정합니다.</DialogDescription>
        {open && <ProjectForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ workspaceName, meId, members, loadError, onRetry, onCreate, onOpenChange }: Props) {
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<ProjectIconName>("folder");
  const [color, setColor] = useState<ProjectColor>("indigo");
  const [access, setAccess] = useState<ProjectAccess>("workspace");
  const [lead, setLead] = useState<string>(meId);
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const leadOptions = members ?? [];
  // 불러오기 전이거나 목록에 없는 리드(비활성 등)는 비운다
  const leadValue = leadOptions.some((m) => m.id === lead) ? lead : NO_LEAD;

  const submit = async () => {
    if (pending) return;
    if (!name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    const message = await onCreate({
      name: name.trim(),
      icon,
      color,
      access,
      leadId: leadValue === NO_LEAD ? null : leadValue,
      description: description.trim() || null,
    });
    setPending(false);
    if (message) setError(message);
    else onOpenChange(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void submit();
        }
      }}
      aria-busy={pending}
      className="flex max-h-[min(80dvh,720px)] flex-col"
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-3">
        {(error || loadError) && (
          <div role="alert" className="flex items-center gap-2 rounded-(--r) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
            <span className="flex-1">{error ?? loadError}</span>
            {!error && loadError && (
              <Button type="button" size="xs" variant="outline" onClick={onRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <ProjectIcon icon={icon} color={color} size={36} className="mt-5 rounded-(--r)" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`${uid}-name`} className="text-(length:--fs-sm) font-medium text-(--text-2)">
              프로젝트 이름
            </label>
            <Input
              id={`${uid}-name`}
              ref={nameRef}
              autoFocus
              value={name}
              maxLength={120}
              placeholder="예: Website Redesign"
              aria-invalid={nameError || undefined}
              aria-describedby={`${uid}-key${nameError ? ` ${uid}-name-err` : ""}`}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
            />
            {nameError && (
              <p id={`${uid}-name-err`} role="alert" className="text-(length:--fs-xs) text-(--red)">
                프로젝트 이름을 입력해 주세요.
              </p>
            )}
            <p id={`${uid}-key`} className="text-(length:--fs-xs) text-(--text-3)">
              키 <span className="font-mono text-(--text-2)">{projectKeyPreview(name)}</span> · 영문 단어 첫 글자로 정해지고,
              이미 쓰는 키면 뒤에 X가 붙습니다.
            </p>
          </div>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-(length:--fs-sm) font-medium text-(--text-2)">아이콘</legend>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PROJECT_ICON_LABELS) as ProjectIconName[]).map((name) => (
              <label key={name} className={cn(swatch, "size-(--h-md)")} title={PROJECT_ICON_LABELS[name]}>
                <input
                  type="radio"
                  name={`${uid}-icon`}
                  value={name}
                  checked={icon === name}
                  onChange={() => setIcon(name)}
                  className="sr-only"
                />
                <ProjectIcon icon={name} color={color} size={22} />
                <span className="sr-only">{PROJECT_ICON_LABELS[name]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-(length:--fs-sm) font-medium text-(--text-2)">색</legend>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((c) => (
              <label key={c} className={cn(swatch, "size-(--h-md) rounded-full")} title={PROJECT_COLORS[c].label}>
                <input
                  type="radio"
                  name={`${uid}-color`}
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="sr-only"
                />
                <span aria-hidden className="size-4 rounded-full" style={{ background: PROJECT_COLORS[c].hex }} />
                <span className="sr-only">{PROJECT_COLORS[c].label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-(length:--fs-sm) font-medium text-(--text-2)">공개 범위</legend>
          <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
            {(["workspace", "private"] as const).map((a) => (
              <label
                key={a}
                className="flex cursor-pointer items-center gap-2 rounded-(--r) border border-(--border) px-3 py-2 text-(length:--fs-sm) text-(--text-2) has-checked:border-(--accent) has-checked:text-(--text) has-focus-visible:ring-2 has-focus-visible:ring-(--accent)"
              >
                <input
                  type="radio"
                  name={`${uid}-access`}
                  value={a}
                  checked={access === a}
                  onChange={() => setAccess(a)}
                  className="accent-(--accent)"
                />
                {GENERAL_ACCESS_LABELS[a](workspaceName)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span id={`${uid}-lead`} className="text-(length:--fs-sm) font-medium text-(--text-2)">
            리드
          </span>
          <Select value={leadValue} onValueChange={setLead} disabled={members === null}>
            <SelectTrigger aria-labelledby={`${uid}-lead`} className="w-full">
              <SelectValue placeholder={members === null ? "구성원 불러오는 중…" : NO_LEAD_LABEL} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LEAD}>{NO_LEAD_LABEL}</SelectItem>
              {leadOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <MemberAvatar name={m.name} color={m.color} size={18} />
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-desc`} className="text-(length:--fs-sm) font-medium text-(--text-2)">
            설명
          </label>
          <Textarea
            id={`${uid}-desc`}
            value={description}
            maxLength={5000}
            rows={3}
            placeholder="프로젝트의 목표와 범위를 적어 주세요."
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 rounded-b-(--r-lg) border-t border-(--divider) bg-(--surface-2) px-4 py-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "만드는 중…" : "프로젝트 만들기"}
        </Button>
      </DialogFooter>
    </form>
  );
}
