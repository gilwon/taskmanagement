// 홈 화면 이동 중 뼈대. 머리말·stat 카드 4개·본문 카드 모양
import { SkeletonCard, SkeletonHeader, SkeletonRoot } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <SkeletonRoot>
      <SkeletonHeader actions />
      <div className="px-(--gutter) pb-(--s-8)">
        <div className="grid grid-cols-4 gap-(--s-3) max-[901px]:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
        <div className="mt-(--s-4) grid grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start gap-(--s-4) max-[1100px]:grid-cols-1">
          <div className="grid min-w-0 gap-(--s-4)">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={4} />
          </div>
          <div className="grid min-w-0 gap-(--s-4)">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}
