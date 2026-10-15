"use client";
// 작업 상세의 활동 탭. 탭을 열 때마다 그 작업의 활동을 새로 읽어 최신순으로 보인다. 상한보다 많으면 전체 개수를 함께 알린다
import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityRow } from "@/components/activity/activity-row";
import { useTasks } from "@/components/tasks/task-store";
import { loadTaskActivities } from "@/lib/comments/actions";
import type { TaskActivity as Row } from "@/lib/comments/queries";
import { taskErrorMessage } from "@/lib/tasks/errors";
import type { TaskItem } from "@/lib/tasks/types";

export function TaskActivity({ task, onCount }: { task: TaskItem; onCount?: (n: number) => void }) {
  const { members, workspace } = useTasks();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    let alive = true;
    loadTaskActivities(task.id)
      .catch((e: unknown) => ({ ok: false as const, error: taskErrorMessage({ message: String(e) }) }))
      .then((r) => {
        if (!alive) return;
        setNow(new Date());
        if (r.ok) {
          setRows(r.data.rows);
          setTotal(r.data.total);
          setError(null);
          onCount?.(r.data.total);
        } else setError(r.error);
      });
    return () => {
      alive = false;
    };
  }, [task.id, reload, onCount]);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-(--r) bg-(--red-soft) px-3 py-2 text-(length:--fs-sm) text-(--red)">
        <span className="flex-1">활동을 불러오지 못했습니다. {error}</span>
        <Button variant="outline" size="xs" onClick={() => setReload((n) => n + 1)}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (!rows) {
    return (
      <p aria-busy="true" className="text-(length:--fs-sm) text-(--text-3)">
        활동을 불러오는 중…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <History size={18} strokeWidth={1.8} aria-hidden className="text-(--text-4)" />
        <p className="text-(length:--fs-sm) text-(--text-3)">아직 활동이 없습니다</p>
      </div>
    );
  }
  return (
    <>
      {total > rows.length && (
        <p className="mb-2 text-(length:--fs-xs) text-(--text-3)">
          전체 {total}건 중 최근 {rows.length}건을 보입니다.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id}>
            <ActivityRow
              a={{
                ...r,
                hasTask: true,
                // 이 작업의 활동이라 지금 제목을 쓴다
                task: { key: task.key, title: task.title },
                project: { key: task.project.key, name: task.project.name },
              }}
              now={now}
              wsSlug={workspace.slug}
              member={(id) => byId.get(id)}
              showProject={false}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
