"use client";
// 삭제 전 확인(환경 설정 "삭제 전 확인"이 켜져 있을 때). 작업·프로젝트·댓글 삭제가 함께 쓴다
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { useT } from "@/lib/i18n/client";

export function DeleteConfirm({
  kind,
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  kind: "task" | "project" | "comment";
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.confirmDelete.title")}
      description={t(`common.confirmDelete.${kind}`, { name: name ?? "" })}
      confirmLabel={t("common.confirmDelete.confirm")}
      onConfirm={async () => {
        onConfirm();
        return null;
      }}
    />
  );
}
