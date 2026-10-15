"use client";
// 선행 작업(Blocked by) 속성 값. 같은 워크스페이스 작업을 검색해 추가하고, 목록에서 뺀다
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusIcon } from "@/components/tasks/parts";
import { searchWorkspaceTasks, type TaskHit } from "@/components/tasks/drawer/actions";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { addDependency, removeDependency } from "@/lib/tasks/actions";
import type { TaskDetail, TaskItem } from "@/lib/tasks/types";

type Dep = TaskDetail["blockedBy"][number];

type Props = {
  task: TaskItem;
  deps: Dep[];
  setDeps: (update: (list: Dep[]) => Dep[]) => void;
  onOpenTask: (key: string) => void;
};

export function BlockedBy({ task, deps, setDeps, onOpenTask }: Props) {
  const { workspace } = useTasks();
  const actions = useTaskActions();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TaskHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 입력이 멈추면 검색한다
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchWorkspaceTasks(workspace.id, q);
      if (!alive) return;
      if (r.ok) {
        setHits(r.data);
        setError(null);
      } else setError(r.error);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, q, workspace.id]);

  const taken = new Set([task.id, ...deps.map((d) => d.id)]);
  const candidates = (hits ?? []).filter((h) => !taken.has(h.id));

  const add = async (hit: TaskHit) => {
    setOpen(false);
    setDeps((list) => [...list, hit]);
    const r = await addDependency(task.id, hit.id);
    if (!r.ok) {
      setDeps((list) => list.filter((d) => d.id !== hit.id));
      return void toast.error(r.error);
    }
    actions.patchLocal(task.id, { blockedBy: r.data.blockedBy });
  };

  const remove = async (dep: Dep) => {
    setDeps((list) => list.filter((d) => d.id !== dep.id));
    const r = await removeDependency(task.id, dep.id);
    if (!r.ok) {
      setDeps((list) => [...list, dep]);
      return void toast.error(r.error);
    }
    actions.patchLocal(task.id, { blockedBy: r.data.blockedBy });
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      {deps.map((d) => (
        <div key={d.id} className="group flex h-(--h-sm) max-w-full items-center gap-1.5 rounded-(--r-sm) px-1.5 hover:bg-(--surface-2)">
          <StatusIcon status={d.status} size={14} />
          <button
            type="button"
            onClick={() => onOpenTask(d.key)}
            className="flex min-w-0 items-center gap-1.5 rounded-(--r-xs) text-left outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <span className="font-mono text-(length:--fs-xs) text-(--text-3)">{d.key}</span>
            <span className="truncate text-(length:--fs-base) text-(--text)">{d.title}</span>
          </button>
          <button
            type="button"
            aria-label={`${d.key} 선행 작업에서 빼기`}
            onClick={() => void remove(d)}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-(--r-xs) text-(--text-3) opacity-0 outline-none group-hover:opacity-100 hover:text-(--text) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <X size={12} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQ("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-(--h-sm) items-center gap-1.5 rounded-(--r-sm) px-1.5 text-(length:--fs-base) text-(--text-4) outline-none hover:bg-(--surface-2) hover:text-(--text-2) focus-visible:ring-2 focus-visible:ring-(--accent)"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            선행 작업 추가
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false} label="선행 작업 검색">
            <CommandInput value={q} onValueChange={setQ} placeholder="작업 키나 제목으로 검색" />
            <CommandList>
              {error ? (
                <p role="alert" className="px-3 py-4 text-center text-(length:--fs-sm) text-(--red)">
                  {error}
                </p>
              ) : hits === null ? (
                <p aria-busy="true" className="px-3 py-4 text-center text-(length:--fs-sm) text-(--text-3)">
                  찾는 중…
                </p>
              ) : (
                <CommandEmpty>일치하는 작업이 없습니다</CommandEmpty>
              )}
              {!error &&
                candidates.map((h) => (
                  <CommandItem key={h.id} value={h.id} onSelect={() => void add(h)}>
                    <StatusIcon status={h.status} size={14} />
                    <span className="font-mono text-(length:--fs-xs) text-(--text-3)">{h.key}</span>
                    <span className="truncate">{h.title}</span>
                  </CommandItem>
                ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
