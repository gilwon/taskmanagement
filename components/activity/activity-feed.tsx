"use client";
// 활동 피드. 종류 필터(전체·상태 변경·댓글·프로젝트)와 사람 선택은 URL(?kind=&by=)에 두고, 날짜(오늘·어제·날짜)로 묶는다.
// "더 보기"는 마지막 행의 (created_at, id) 커서로 다음 쪽을 이어 붙인다. 작업 행을 누르면 작업 드로어가 열린다
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityRow } from "@/components/activity/activity-row";
import { EmptyState } from "@/components/shell/empty-state";
import { TaskDrawerHost } from "@/components/tasks/drawer";
import { useTaskDrawer } from "@/components/tasks/task-drawer-state";
import { useTasks } from "@/components/tasks/task-store";
import { announce } from "@/components/tasks/views/shared";
import { loadMoreActivities } from "@/lib/activity/actions";
import type { ActivityFilter, ActivityKind, ActivityPage } from "@/lib/activity/queries";
import { ACTIVITY_KIND_LABELS, EVERYONE_LABEL } from "@/lib/i18n/labels";
import { dayGroup, groupInOrder } from "@/lib/notifications/groups";
import { taskErrorMessage } from "@/lib/tasks/errors";
import { cn } from "@/lib/utils";

type Props = {
  initial: ActivityPage;
  projectId: string | null;
  filter: ActivityFilter;
  nowIso: string;
};

const KINDS = Object.keys(ACTIVITY_KIND_LABELS) as ("all" | ActivityKind)[];
const ALL_PEOPLE = "all";

export function ActivityFeed(props: Props) {
  // 필터가 바뀌면 이어 붙인 목록을 버리고 새 첫 쪽부터 보인다. 드로어 열기(?task)로 다시 그려질 때는 목록을 지킨다
  const key = `${props.filter.kind ?? ""}|${props.filter.actorId ?? ""}`;
  return (
    <>
      <Feed key={key} {...props} />
      <TaskDrawerHost />
    </>
  );
}

function Feed({ initial, projectId, filter, nowIso }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { workspace, members } = useTasks();
  const { open } = useTaskDrawer();
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [busy, setBusy] = useState(false);
  const now = new Date(nowIso);
  const byId = new Map(members.map((m) => [m.id, m]));

  // 필터를 바꾼 주소. 드로어(?task)는 닫는다
  const hrefWith = (key: "kind" | "by", value: string | null) => {
    const q = new URLSearchParams(params.toString());
    q.delete("task");
    if (value) q.set(key, value);
    else q.delete(key);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const more = async () => {
    if (!next || busy) return;
    setBusy(true);
    const r = await loadMoreActivities(workspace.id, projectId, filter, next).catch((e: unknown) => ({
      ok: false as const,
      error: taskErrorMessage({ message: String(e) }),
    }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setItems((list) => [...list, ...r.data.items]);
    setNext(r.data.next);
    announce(`활동 ${r.data.items.length}건을 더 불러왔습니다`);
  };

  const groups = groupInOrder(items, (a) => dayGroup(a.created_at, now).key);
  const filtered = !!filter.kind || !!filter.actorId;

  return (
    <div className="flex flex-col gap-(--s-4) px-(--gutter) pb-(--s-8)">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="활동 종류" className="flex flex-wrap gap-1">
          {KINDS.map((k) => {
            const current = (filter.kind ?? "all") === k;
            return (
              <Link
                key={k}
                href={hrefWith("kind", k === "all" ? null : k)}
                aria-current={current ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-(--h-sm) items-center rounded-(--r-sm) px-2.5 text-(length:--fs-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                  current ? "bg-(--surface-3) font-medium text-(--text)" : "text-(--text-3) hover:bg-(--surface-2) hover:text-(--text)",
                )}
              >
                {ACTIVITY_KIND_LABELS[k]}
              </Link>
            );
          })}
        </nav>
        <Select
          value={filter.actorId ?? ALL_PEOPLE}
          onValueChange={(v) => router.push(hrefWith("by", v === ALL_PEOPLE ? null : v), { scroll: false })}
        >
          <SelectTrigger size="sm" aria-label="사람" className="ml-auto w-44 max-[480px]:ml-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_PEOPLE}>{EVERYONE_LABEL}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={History}
          title={filtered ? "조건에 맞는 활동이 없습니다" : "아직 활동이 없습니다"}
          description={filtered ? "다른 종류나 사람을 골라 보세요." : "작업을 만들거나 옮기면 여기에 기록됩니다."}
        />
      ) : (
        <div className="flex flex-col gap-(--s-5)">
          {groups.map((g) => {
            const label = dayGroup(g.items[0].created_at, now).label;
            return (
              <section key={g.key} aria-label={label} className="flex flex-col gap-1">
                <h2 className="text-(length:--fs-xs) font-semibold text-(--text-3)">{label}</h2>
                <ul className="flex flex-col rounded-(--r-lg) border border-(--border) bg-(--surface)">
                  {g.items.map((a) => (
                    <li
                      key={a.id}
                      // 행 아무 곳이나 눌러도 작업을 연다. 키보드는 행 안의 작업 이름 버튼으로 연다
                      onClick={(e) => {
                        if (!a.task || (e.target as HTMLElement).closest("a,button")) return;
                        open(a.task.key);
                      }}
                      className={cn(
                        "border-b border-(--divider) px-(--s-4) py-(--s-3) last:border-b-0",
                        a.task && "cursor-pointer hover:bg-(--surface-2)",
                      )}
                    >
                      <ActivityRow a={a} now={now} wsSlug={workspace.slug} member={(id) => byId.get(id)} onOpenTask={open} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {next && (
            <Button variant="outline" size="sm" className="self-center" onClick={() => void more()} disabled={busy} aria-busy={busy}>
              {busy ? "불러오는 중…" : "더 보기"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
