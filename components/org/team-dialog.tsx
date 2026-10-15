"use client";
// 팀 만들기·편집 대화상자. 이름·설명·아이콘·색을 받는다. 만든 뒤에는 팀 상세로 이동한다
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProjectIcon } from "@/components/shell/project-icon";
import { announce } from "@/components/tasks/views/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { ICON_LABELS, NAV_LABELS, PROJECT_COLORS, type ProjectColor } from "@/lib/i18n/labels";
import { createTeam, updateTeam, type TeamInput } from "@/lib/org/actions";
import type { OrgTeam } from "@/lib/org/queries";
import { TEAM_ICONS } from "@/lib/org/rules";
import { cn } from "@/lib/utils";

const choice =
  "inline-flex size-8 items-center justify-center rounded-(--r) border border-(--border) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--accent) aria-checked:border-(--accent) aria-checked:bg-(--accent-soft)";

// 라디오 그룹. 방향키로 고르고 Tab으로 빠져나간다
function Radios<T extends string>({
  label,
  values,
  value,
  onChange,
  render,
  name,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
  name: (v: T) => string;
}) {
  const move = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = values[(i + step + values.length) % values.length];
    onChange(next);
    (e.currentTarget.parentElement?.children[values.indexOf(next)] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-(length:--fs-sm) font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === value}
            aria-label={name(v)}
            tabIndex={v === value ? 0 : -1}
            onClick={() => onChange(v)}
            onKeyDown={(e) => move(e, i)}
            className={choice}
          >
            {render(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

// 입력 상태는 처음 열릴 때 team으로 채운다. 다른 팀을 열 때는 호출부가 key를 바꿔 새로 만든다
export function TeamDialog({
  workspace,
  team,
  open,
  onOpenChange,
}: {
  workspace: { id: string; slug: string };
  // 없으면 새 팀
  team?: OrgTeam;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<TeamInput>(() => ({
    name: team?.name ?? "",
    description: team?.description ?? "",
    icon: team?.icon ?? "folder",
    color: team?.color ?? "indigo",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = Object.keys(PROJECT_COLORS) as ProjectColor[];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim()) return setError("팀 이름을 입력해 주세요.");
    setBusy(true);
    const r = team ? await updateTeam(team.id, form) : await createTeam(workspace.id, form);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const msg = team ? "팀을 저장했습니다." : `${form.name.trim()} 팀을 만들었습니다.`;
    toast.success(msg);
    announce(msg);
    onOpenChange(false);
    if (r.data?.id) router.push(`/${workspace.slug}/teams/${r.data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} method="post" className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{team ? "팀 편집" : NAV_LABELS.newTeam}</DialogTitle>
            <DialogDescription>팀은 구성원과 프로젝트를 묶어 보는 단위입니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">이름</Label>
            <Input
              id="team-name"
              autoFocus
              maxLength={80}
              value={form.name}
              aria-invalid={!!error}
              aria-describedby={error ? "team-error" : undefined}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setError(null);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-desc">설명</Label>
            <Textarea
              id="team-desc"
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Radios
            label="아이콘"
            values={TEAM_ICONS}
            value={form.icon as (typeof TEAM_ICONS)[number]}
            onChange={(icon) => setForm({ ...form, icon })}
            name={(v) => ICON_LABELS[v]}
            render={(v) => <ProjectIcon icon={v} color={form.color} size={22} />}
          />
          <Radios
            label="색"
            values={colors}
            value={form.color as ProjectColor}
            onChange={(color) => setForm({ ...form, color })}
            name={(v) => PROJECT_COLORS[v].label}
            render={(v) => (
              <span aria-hidden className={cn("size-4 rounded-full")} style={{ background: PROJECT_COLORS[v].hex }} />
            )}
          />
          {error && (
            <p id="team-error" role="alert" className="text-(length:--fs-sm) text-(--red)">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {team ? "저장" : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
