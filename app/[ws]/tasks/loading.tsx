// 작업 화면 이동 중 뼈대. 머리말·필터 막대·작업 목록 모양
import { SkeletonHeader, SkeletonRoot, SkeletonTable, SkeletonToolbar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <SkeletonRoot>
      <SkeletonHeader />
      <SkeletonToolbar />
      <SkeletonTable rows={10} />
    </SkeletonRoot>
  );
}
