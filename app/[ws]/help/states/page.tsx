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
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// production에서는 404이므로 이 화면 제목을 남기지 않는다
export async function generateMetadata(): Promise<Metadata> {
  return process.env.NODE_ENV === "production" ? {} : { title: (await getT())("common.nav.states") };
}

// META §3 빈 상태 문구. 이미 화면에서 쓰는 문구는 그대로 옮기고, 보관함·팀은 아직 화면이 없어 새로 정했다.
// 문구는 help.states.emptySample.<key>이고 description은 있는 것만 보인다
const EMPTY_STATES = [
  { icon: ListChecks, key: "tasks", description: true },
  { icon: SearchX, key: "noResults", description: true },
  { icon: FolderKanban, key: "projects" },
  { icon: ChartGantt, key: "timeline", description: true },
  { icon: FolderOpen, key: "files" },
  { icon: Archive, key: "archived" },
  { icon: Users, key: "teams" },
  { icon: History, key: "activity", description: true },
  { icon: CalendarX, key: "schedule" },
] as const satisfies { icon: LucideIcon; key: string; description?: true }[];

// 반짝이는 자리표시 막대. data-motion이 full이 아니면 globals.css가 애니메이션을 끈다
const shimmer =
  "animate-[shimmer_1.4s_linear_infinite] rounded-(--r-xs) bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-size-[200%_100%]";

export default async function HelpStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getT();
  return (
    <>
      <PageHeader title={t("common.nav.states")} subtitle={t("help.states.subtitle")} />

      <ShowcaseSection id="st-empty" title={t("help.states.empty")}>
        {/* EmptyState의 바깥 여백(--gutter)은 섹션 여백과 겹치므로 견본에서는 없앤다 */}
        <div className="grid gap-(--s-3) *:mx-0 md:grid-cols-2 xl:grid-cols-3">
          {EMPTY_STATES.map((e) => (
            <EmptyState
              key={e.key}
              icon={e.icon}
              title={t(`help.states.emptySample.${e.key}.title`)}
              description={"description" in e ? t(`help.states.emptySample.${e.key}.description`) : undefined}
            />
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="st-loading" title={t("help.states.loading")}>
        <ShowcaseGroup title={t("help.states.listRows")}>
          <div aria-busy="true" className="overflow-hidden rounded-(--r-lg) bg-(--surface) shadow-(--shadow-card)">
            <span className="sr-only">{t("help.states.loadingLabel")}</span>
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
        <ShowcaseGroup title={t("help.states.cards")}>
          <div aria-busy="true" className="grid gap-(--s-3) sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">{t("help.states.loadingLabel")}</span>
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

      <ShowcaseSection id="st-access" title={t("help.states.access")} description={t("help.states.accessDescription")}>
        <div className="grid gap-(--s-3) md:grid-cols-2">
          <div className="rounded-(--r-lg) border border-(--border)">
            <ErrorState kind="forbidden" />
          </div>
          <div className="rounded-(--r-lg) border border-(--border) py-(--s-3) *:mx-0 *:border-0">
            <EmptyState
              icon={SearchX}
              title={t("errors.notFound.title")}
              description={t("errors.notFound.workspace")}
            />
          </div>
        </div>
      </ShowcaseSection>
    </>
  );
}
