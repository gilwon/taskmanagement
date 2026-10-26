// 구성원 화면 이동 중 뼈대. 머리말·검색 막대·구성원 표 모양
import { SkeletonHeader, SkeletonRoot, SkeletonTable, SkeletonToolbar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <SkeletonRoot>
      <SkeletonHeader actions />
      <SkeletonToolbar />
      <SkeletonTable rows={8} />
    </SkeletonRoot>
  );
}
