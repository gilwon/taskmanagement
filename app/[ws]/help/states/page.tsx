// 개발 전용 화면 상태 견본. 빈 상태·로딩·오류·확인 상태를 모아 보인다. 운영 빌드에서는 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Archive,
  CalendarX,
  ChartGantt,
  FolderOpen,
  FolderKanban,
  History,
  ListChecks,
  SearchX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatesDemos } from "@/components/help/states-demos";
import { ShowcaseGroup, ShowcaseSection } from "@/components/help/showcase-section";
import { EmptyState } from "@/components/shell/empty-state";
import { ErrorState } from "@/components/shell/error-state";
import { PageHeader } from "@/components/shell/page-header";
import { NAV_LABELS } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

// production에서는 404이므로 이 화면 제목을 남기지 않는다
export const metadata: Metadata = process.env.NODE_ENV === "production" ? {} : { title: NAV_LABELS.states };

// META §3 빈 상태 문구. 이미 화면에서 쓰는 문구는 그대로 옮기고, 보관함·팀은 아직 화면이 없어 새로 정했다
const EMPTY_STATES: { icon: LucideIcon; title: string; description?: string }[] = [
  { icon: ListChecks, title: "작업이 없습니다", description: "작업을 추가해 일을 시작하세요." },
  { icon: SearchX, title: "결과가 없습니다", description: "이 조건에 맞는 작업이 없습니다." },
  { icon: FolderKanban, title: "아직 프로젝트가 없습니다" },
  { icon: ChartGantt, title: "타임라인에 표시할 작업이 없습니다", description: "작업에 시작일과 기한을 넣으면 여기에 보입니다." },
  { icon: FolderOpen, title: "아직 파일이 없습니다" },
  { icon: Archive, title: "보관된 작업이 없습니다" },
  { icon: Users, title: "아직 팀이 없습니다" },
  { icon: History, title: "아직 활동이 없습니다", description: "작업을 만들거나 옮기면 여기에 기록됩니다." },
  { icon: CalendarX, title: "예정된 일정이 없습니다" },
];

// 반짝이는 자리표시 막대. data-motion이 full이 아니면 globals.css가 애니메이션을 끈다
const shimmer =
  "animate-[shimmer_1.4s_linear_infinite] rounded-(--r-xs) bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-size-[200%_100%]";

export default function HelpStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <PageHeader title={NAV_LABELS.states} subtitle="빈 상태·로딩·오류·확인 상태를 모아 봅니다. 개발 환경에서만 열립니다." />

      <ShowcaseSection id="st-empty" title="빈 상태">
        {/* EmptyState의 바깥 여백(--gutter)은 섹션 여백과 겹치므로 견본에서는 없앤다 */}
        <div className="grid gap-(--s-3) *:mx-0 md:grid-cols-2 xl:grid-cols-3">
          {EMPTY_STATES.map((e) => (
            <EmptyState key={e.title} icon={e.icon} title={e.title} description={e.description} />
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="st-loading" title="로딩">
        <ShowcaseGroup title="목록 행">
          <div aria-busy="true" className="overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
            <span className="sr-only">불러오는 중</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden className="flex h-(--row-h) items-center gap-(--s-3) border-b border-(--divider) px-(--s-4) last:border-b-0">
                <span className={cn(shimmer, "size-3.5 rounded-(--r-full)")} />
                <span className={cn(shimmer, "h-3 w-12")} />
                <span className={cn(shimmer, "h-3 min-w-0 flex-1")} />
                <span className={cn(shimmer, "hidden h-3 w-16 sm:block")} />
                <span className={cn(shimmer, "size-5 rounded-(--r-full)")} />
              </div>
            ))}
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="카드">
          <div aria-busy="true" className="grid gap-(--s-3) sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">불러오는 중</span>
            {[0, 1, 2].map((i) => (
              <div key={i} aria-hidden className="flex flex-col gap-(--s-2) rounded-(--r-lg) bg-(--surface) p-(--card-pad) shadow-(--shadow-card)">
                <span className={cn(shimmer, "h-3 w-16")} />
                <span className={cn(shimmer, "h-3.5 w-full")} />
                <span className={cn(shimmer, "h-3.5 w-2/3")} />
                <div className="mt-(--s-1) flex items-center gap-(--s-2)">
                  <span className={cn(shimmer, "h-(--h-xs) w-14")} />
                  <span className={cn(shimmer, "ml-auto size-5 rounded-(--r-full)")} />
                </div>
              </div>
            ))}
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>

      <StatesDemos />

      <ShowcaseSection id="st-access" title="접근 권한·없는 페이지" description="403·404 화면과 같은 문구입니다.">
        <div className="grid gap-(--s-3) md:grid-cols-2">
          <div className="rounded-(--r-lg) border border-(--border)">
            <ErrorState kind="forbidden" />
          </div>
          <div className="rounded-(--r-lg) border border-(--border) py-(--s-3) *:mx-0 *:border-0">
            <EmptyState
              icon={SearchX}
              title="페이지를 찾을 수 없습니다"
              description="주소가 바뀌었거나 삭제되었거나, 볼 권한이 없는 워크스페이스입니다."
            />
          </div>
        </div>
      </ShowcaseSection>
    </>
  );
}
