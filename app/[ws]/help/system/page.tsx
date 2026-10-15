// 개발 전용 디자인 시스템 견본 화면. 토큰·컴포넌트·작업 표시 부품을 모아 보인다. 운영 빌드에서는 404
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { SystemDemos } from "@/components/help/system-demos";
import { Sample, ShowcaseGroup, ShowcaseSection } from "@/components/help/showcase-section";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { LabelChips, PriorityIcon, StatusIcon, TaskKey } from "@/components/tasks/parts/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/lib/database.types";
import {
  NAV_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_LABEL_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/i18n/labels";
import type { TaskPriority, TaskStatus } from "@/lib/tasks/types";

// production에서는 404이므로 이 화면 제목을 남기지 않는다
export const metadata: Metadata = process.env.NODE_ENV === "production" ? {} : { title: NAV_LABELS.system };

// globals.css에 실제로 있는 색 변수만 나열한다. 값은 테마마다 달라 이름만 보인다
const COLOR_GROUPS: { title: string; kind: "fill" | "text" | "line"; names: string[] }[] = [
  { title: "배경·표면", kind: "fill", names: ["--bg", "--bg-side", "--surface", "--surface-2", "--surface-3", "--sunken", "--overlay"] },
  { title: "테두리", kind: "line", names: ["--border", "--border-strong", "--divider"] },
  { title: "텍스트", kind: "text", names: ["--text", "--text-2", "--text-3", "--text-4", "--on-accent", "--accent-ink", "--sun-ink", "--sat-ink"] },
  { title: "강조", kind: "fill", names: ["--accent", "--accent-soft", "--accent-line"] },
  {
    title: "의미 색",
    kind: "fill",
    names: ["--green", "--green-soft", "--amber", "--amber-soft", "--red", "--red-soft", "--blue", "--violet", "--teal", "--rose", "--orange", "--gray"],
  },
  { title: "작업 상태", kind: "fill", names: ["--st-backlog", "--st-todo", "--st-progress", "--st-review", "--st-done"] },
];

const FONT_SIZES = ["--fs-2xs", "--fs-xs", "--fs-sm", "--fs-base", "--fs-md", "--fs-lg", "--fs-xl", "--fs-2xl"];
const SPACES = ["--s-1", "--s-2", "--s-3", "--s-4", "--s-5", "--s-6", "--s-8", "--s-10", "--s-12"];
const RADII = ["--r-xs", "--r-sm", "--r", "--r-lg", "--r-full"];
const SHADOWS = ["--shadow-card", "--shadow-pop", "--shadow-drag"];
const HEIGHTS = ["--h-xs", "--h-sm", "--h-md", "--h-lg"];

const BUTTON_VARIANTS = [
  ["default", "기본"],
  ["outline", "외곽선"],
  ["secondary", "보조"],
  ["ghost", "고스트"],
  ["destructive", "위험"],
  ["link", "링크"],
] as const;
const BUTTON_SIZES = [
  ["xs", "아주 작게"],
  ["sm", "작게"],
  ["default", "기본"],
  ["lg", "크게"],
] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const BADGE_VARIANTS = [
  ["default", "기본"],
  ["secondary", "보조"],
  ["destructive", "위험"],
  ["outline", "외곽선"],
  ["ghost", "고스트"],
] as const;

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];
const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as Enums<"project_status">[];
const PROJECT_SAMPLES = [
  ["globe", "indigo"],
  ["smartphone", "blue"],
  ["megaphone", "rose"],
  ["rocket", "amber"],
  ["component", "violet"],
  ["building-2", "teal"],
] as const;

const swatchGrid = "grid grid-cols-2 gap-(--s-3) sm:grid-cols-4 lg:grid-cols-6";
const row = "flex flex-wrap items-end gap-(--s-4)";

function Swatch({ name, kind }: { name: string; kind: "fill" | "text" | "line" }) {
  const v = `var(${name})`;
  return (
    <li className="min-w-0">
      {kind === "text" ? (
        <div
          className="flex h-10 items-center rounded-(--r-sm) px-(--s-2) text-(length:--fs-md) font-medium shadow-(--shadow-card)"
          style={{ color: v, background: name === "--on-accent" ? "var(--accent)" : "var(--surface)" }}
        >
          가나다 Aa
        </div>
      ) : kind === "line" ? (
        <div className="h-10 rounded-(--r-sm) border-2 bg-(--surface)" style={{ borderColor: v }} />
      ) : (
        <div className="h-10 rounded-(--r-sm) shadow-(--shadow-card)" style={{ background: v }} />
      )}
      <code className="mt-1 block font-mono text-(length:--fs-2xs) break-all text-(--text-3)">{name}</code>
    </li>
  );
}

export default function HelpSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <PageHeader title={NAV_LABELS.system} subtitle="버튼·입력·색·간격 등 디자인 시스템 요소를 모아 봅니다. 개발 환경에서만 열립니다." />

      <ShowcaseSection id="sys-colors" title="색" description="테마(밝게·어둡게)와 강조색 설정에 따라 값이 바뀝니다.">
        {COLOR_GROUPS.map((g) => (
          <ShowcaseGroup key={g.title} title={g.title}>
            <ul className={swatchGrid}>
              {g.names.map((n) => (
                <Swatch key={n} name={n} kind={g.kind} />
              ))}
            </ul>
          </ShowcaseGroup>
        ))}
      </ShowcaseSection>

      <ShowcaseSection id="sys-type" title="글자 크기">
        <ul className="flex flex-col gap-(--s-2)">
          {FONT_SIZES.map((n) => (
            <li key={n} className="flex min-w-0 items-baseline gap-(--s-3)">
              <code className="w-20 shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{n}</code>
              <span className="min-w-0 truncate text-(--text)" style={{ fontSize: `var(${n})` }}>
                작업을 추가해 일을 시작하세요
              </span>
            </li>
          ))}
        </ul>
      </ShowcaseSection>

      <ShowcaseSection id="sys-space" title="간격">
        <ul className="flex flex-col gap-(--s-2)">
          {SPACES.map((n) => (
            <li key={n} className="flex items-center gap-(--s-3)">
              <code className="w-20 shrink-0 font-mono text-(length:--fs-2xs) text-(--text-3)">{n}</code>
              <span className="h-2 rounded-(--r-full) bg-(--accent)" style={{ width: `var(${n})` }} />
            </li>
          ))}
        </ul>
      </ShowcaseSection>

      <ShowcaseSection id="sys-radius" title="반경·그림자·높이">
        <ShowcaseGroup title="반경">
          <div className={row}>
            {RADII.map((n) => (
              <Sample key={n} name={n}>
                <span className="block size-14 border border-(--border-strong) bg-(--surface-2)" style={{ borderRadius: `var(${n})` }} />
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="그림자">
          <div className={row}>
            {SHADOWS.map((n) => (
              <Sample key={n} name={n}>
                <span className="block h-16 w-28 rounded-(--r) bg-(--surface)" style={{ boxShadow: `var(${n})` }} />
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="컨트롤 높이">
          <div className={row}>
            {HEIGHTS.map((n) => (
              <Sample key={n} name={n}>
                <span className="block w-16 rounded-(--r-sm) border border-(--accent-line) bg-(--accent-soft)" style={{ height: `var(${n})` }} />
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="sys-button" title="버튼">
        <ShowcaseGroup title="변형">
          <div className={row}>
            {BUTTON_VARIANTS.map(([v, label]) => (
              <Sample key={v} name={v}>
                <Button variant={v}>{label}</Button>
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="크기">
          <div className={row}>
            {BUTTON_SIZES.map(([s, label]) => (
              <Sample key={s} name={s}>
                <Button size={s} variant="outline">
                  {label}
                </Button>
              </Sample>
            ))}
            {ICON_SIZES.map((s) => (
              <Sample key={s} name={s}>
                <Button size={s} variant="outline" aria-label="추가">
                  <Plus aria-hidden strokeWidth={1.8} />
                </Button>
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="비활성">
          <div className={row}>
            {BUTTON_VARIANTS.map(([v, label]) => (
              <Sample key={v} name={`${v} disabled`}>
                <Button variant={v} disabled>
                  {label}
                </Button>
              </Sample>
            ))}
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="sys-badge" title="배지">
        <div className={row}>
          {BADGE_VARIANTS.map(([v, label]) => (
            <Sample key={v} name={v}>
              <Badge variant={v}>{label}</Badge>
            </Sample>
          ))}
        </div>
      </ShowcaseSection>

      <SystemDemos />

      <ShowcaseSection id="sys-task" title="작업 표시 부품">
        <ShowcaseGroup title="상태">
          <ul className={row}>
            {STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-(length:--fs-base) text-(--text-2)">
                <StatusIcon status={s} />
                <span aria-hidden>{TASK_STATUS_LABELS[s]}</span>
              </li>
            ))}
          </ul>
        </ShowcaseGroup>
        <ShowcaseGroup title="우선순위">
          <ul className={row}>
            {PRIORITIES.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-(length:--fs-base) text-(--text-2)">
                <PriorityIcon priority={p} />
                <span aria-hidden>{TASK_PRIORITY_LABELS[p]}</span>
              </li>
            ))}
          </ul>
        </ShowcaseGroup>
        <ShowcaseGroup title="라벨">
          <div className="flex flex-col gap-(--s-2)">
            <LabelChips labels={Object.keys(TASK_LABEL_LABELS)} />
            <Sample name="max={2}">
              <LabelChips labels={["design", "frontend", "bug", "qa"]} max={2} />
            </Sample>
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="작업 키">
          <div className={row}>
            <TaskKey value="WEB-12" />
            <TaskKey value="MOB-108" />
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>

      <ShowcaseSection id="sys-project" title="프로젝트·구성원">
        <ShowcaseGroup title="프로젝트 아이콘">
          <div className={row}>
            {PROJECT_SAMPLES.map(([icon, color]) => (
              <Sample key={icon} name={`${icon} · ${color}`}>
                <ProjectIcon icon={icon} color={color} size={24} />
              </Sample>
            ))}
            <Sample name="size 18">
              <ProjectIcon icon="globe" color="indigo" />
            </Sample>
          </div>
        </ShowcaseGroup>
        <ShowcaseGroup title="프로젝트 상태">
          <ul className={row}>
            {PROJECT_STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-(length:--fs-base) text-(--text-2)">
                <ProjectStatusDot status={s} />
                <span aria-hidden>{PROJECT_STATUS_LABELS[s]}</span>
              </li>
            ))}
          </ul>
        </ShowcaseGroup>
        <ShowcaseGroup title="구성원 아바타">
          <div className={row}>
            <Sample name="size 20">
              <MemberAvatar name="김지윤" color="indigo" size={20} />
            </Sample>
            <Sample name="size 24">
              <MemberAvatar name="Alex Kim" color="teal" />
            </Sample>
            <Sample name="size 32 · online">
              <MemberAvatar name="박서준" color="rose" size={32} online />
            </Sample>
          </div>
        </ShowcaseGroup>
      </ShowcaseSection>
    </>
  );
}
