// 재고 화면 이동 중 뼈대. 머리말·필터 막대·품목 표 모양
import { SkeletonHeader, SkeletonRoot, SkeletonTable, SkeletonToolbar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <SkeletonRoot>
      <SkeletonHeader actions />
      <SkeletonToolbar />
      <SkeletonTable rows={10} />
    </SkeletonRoot>
  );
}
