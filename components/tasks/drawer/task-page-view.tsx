"use client";
// 작업 전체 페이지 본문. 단일 작업 store의 작업을 TaskDetailPanel로 넓게 보이고, 삭제되면 안내와 실행 취소 대기 상태를 보인다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { cameFromDrawer } from "@/components/tasks/drawer/task-drawer-host";
import { TaskDetailPanel } from "@/components/tasks/drawer/task-detail-panel";
import { useTasks } from "@/components/tasks/task-store";
import { useT } from "@/lib/i18n/client";

export function TaskPageView({ taskId, taskKey }: { taskId: string; taskKey: string }) {
  const t = useT();
  const router = useRouter();
  const { items, workspace } = useTasks();
  const task = items.find((item) => item.id === taskId);
  const ws = workspace.slug;

  if (!task) {
    return (
      <div className="py-(--s-8)">
        <h1 className="sr-only">{taskKey}</h1>
        <EmptyState
          icon={Trash2}
          title={t("tasks.drawer.deletedTitle")}
          description={t("tasks.drawer.deletedDescription")}
          action={
            <Link href={`/${ws}/tasks`} className="text-(length:--fs-sm) text-(--accent) underline">
              {t("tasks.drawer.backToList")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <h1 className="sr-only">
        {task.key} {task.title}
      </h1>
      <TaskDetailPanel
        task={task}
        mode="page"
        // 드로어에서 넘어왔으면 그 화면으로 돌아가고, 아니면 작업 목록의 드로어로 연다
        onToggleLayout={() =>
          cameFromDrawer(ws, task.key) ? router.back() : router.push(`/${ws}/tasks?task=${task.key}`)
        }
        onOpenTask={(key) => router.push(`/${ws}/task/${key}`)}
      />
    </div>
  );
}
