"use client";
// 작업 상세 아래쪽 탭. 댓글(n) / 활동(n) / 파일(n). 탭 내용은 열 때 그리고, 활동은 열 때마다 새로 읽는다
import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskActivity } from "@/components/activity/task-activity";
import { TaskComments } from "@/components/comments/task-comments";
import { TaskAttachments } from "@/components/files/task-attachments";
import { useTaskActions, useTasks } from "@/components/tasks/task-store";
import { DETAIL_TAB_LABELS } from "@/lib/i18n/labels";
import type { TaskItem } from "@/lib/tasks/types";

export function DetailTabs({ task }: { task: TaskItem }) {
  const { workspace } = useTasks();
  const { patchLocal } = useTaskActions();
  // 첨부 수가 바뀌면 목록 카드의 첨부 수도 맞춘다
  const onFileCount = useCallback((n: number) => patchLocal(task.id, { attachmentCount: n }), [patchLocal, task.id]);
  // 활동 수는 탭을 처음 열어 읽은 뒤에 보인다
  const [activityCount, setActivityCount] = useState<{ id: string; n: number } | null>(null);
  const shownActivity = activityCount?.id === task.id ? activityCount.n : null;
  // 활동 탭의 읽기 효과가 이 함수에 걸려 있어 작업이 바뀔 때만 새로 만든다
  const onActivityCount = useCallback((n: number) => setActivityCount({ id: task.id, n }), [task.id]);

  return (
    <Tabs defaultValue="comments" className="gap-3">
      <TabsList>
        <TabsTrigger value="comments">
          {DETAIL_TAB_LABELS.comments} ({task.commentCount})
        </TabsTrigger>
        <TabsTrigger value="activity">
          {DETAIL_TAB_LABELS.activity}
          {shownActivity !== null && ` (${shownActivity})`}
        </TabsTrigger>
        <TabsTrigger value="files">
          {DETAIL_TAB_LABELS.files} ({task.attachmentCount})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comments">
        <TaskComments key={task.id} task={task} />
      </TabsContent>
      <TabsContent value="activity">
        <TaskActivity key={task.id} task={task} onCount={onActivityCount} />
      </TabsContent>
      <TabsContent value="files">
        <TaskAttachments
          key={task.id}
          workspaceId={workspace.id}
          projectId={task.project.id}
          taskId={task.id}
          onCountChange={onFileCount}
        />
      </TabsContent>
    </Tabs>
  );
}
