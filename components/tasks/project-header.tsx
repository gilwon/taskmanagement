// 프로젝트 화면 머리말. 아이콘 타일·이름·즐겨찾기 토글·상태 pill·구성원 아바타와 탭(기본 탭·저장 뷰·+ 저장 뷰)
import Link from "next/link";
import { MemberAvatar } from "@/components/shell/member-avatar";
import { ProjectIcon, ProjectStatusDot } from "@/components/shell/project-icon";
import { ProjectFavoriteButton } from "@/components/tasks/project-favorite-button";
import { SaveViewDialog } from "@/components/tasks/save-view-dialog";
import { SavedViewTab } from "@/components/tasks/saved-view-tab";
import type { Enums } from "@/lib/database.types";
import { getProjectHeader } from "@/lib/data/project";
import { PROJECT_TAB_LABELS, type ProjectTab } from "@/lib/i18n/labels";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const TABS = Object.keys(PROJECT_TAB_LABELS) as ProjectTab[];
const MAX_AVATARS = 4;

const tabCls =
  "inline-flex h-9 shrink-0 items-center border-b-2 px-2 text-(length:--fs-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset";

export async function ProjectHeader({
  wsSlug,
  workspaceId,
  userId,
  project,
  active,
}: {
  wsSlug: string;
  workspaceId: string;
  userId: string;
  project: {
    id: string;
    key: string;
    name: string;
    icon: string;
    color: string;
    status: Enums<"project_status">;
  };
  // 기본 탭 이름 또는 저장 뷰 id
  active: ProjectTab | { view: string };
}) {
  const [{ members, favorite, savedViews }, t] = await Promise.all([getProjectHeader(project.id, userId), getT()]);
  const base = `/${wsSlug}/projects/${encodeURIComponent(project.key)}`;
  const isActive = (tab: ProjectTab | string) => (typeof active === "string" ? active === tab : active.view === tab);
  const defaultType = active === "board" || active === "table" ? active : "list";

  return (
    <header className="px-(--gutter) pt-(--s-5)">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <ProjectIcon icon={project.icon} color={project.color} size={32} className="rounded-(--r)" />
        <h1 className="min-w-0 truncate text-(length:--fs-xl) font-semibold tracking-tight text-(--text)">
          {project.name}
        </h1>
        <ProjectFavoriteButton workspaceId={workspaceId} projectId={project.id} favorite={favorite} />
        <span className="inline-flex h-(--h-sm) shrink-0 items-center gap-1.5 rounded-(--r-full) border border-(--border) bg-(--surface) px-2.5 text-(length:--fs-xs) text-(--text-2)">
          <ProjectStatusDot status={project.status} />
          {t(`common.projectStatus.${project.status}`)}
        </span>
        <span className="flex-1" />
        {members.length > 0 && (
          <ul aria-label={t("tasks.project.members", { count: members.length })} className="hide-m flex items-center -space-x-1.5">
            {members.slice(0, MAX_AVATARS).map((m) => (
              <li key={m.id} title={m.name} className="rounded-full ring-2 ring-(--bg)">
                <MemberAvatar name={m.name} color={m.color} size={24} />
                <span className="sr-only">{m.name}</span>
              </li>
            ))}
            {members.length > MAX_AVATARS && (
              <li className="inline-flex size-6 items-center justify-center rounded-full bg-(--surface-3) text-(length:--fs-2xs) text-(--text-2) ring-2 ring-(--bg)">
                +{members.length - MAX_AVATARS}
              </li>
            )}
          </ul>
        )}
      </div>
      <nav aria-label={t("tasks.project.viewsNav")} className="mt-(--s-3) flex gap-1 overflow-x-auto border-b border-(--border)">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`${base}/${tab}`}
            aria-current={isActive(tab) ? "page" : undefined}
            className={cn(
              tabCls,
              isActive(tab)
                ? "border-(--accent) font-medium text-(--text)"
                : "border-transparent text-(--text-3) hover:text-(--text)",
            )}
          >
            {t(`common.projectTab.${tab}`)}
          </Link>
        ))}
        {savedViews.map((v) => (
          <SavedViewTab
            key={v.id}
            href={`${base}/views/${v.id}`}
            name={v.name}
            current={isActive(v.id)}
            className={cn(
              tabCls,
              "max-w-40",
              isActive(v.id)
                ? "border-(--accent) font-medium text-(--text)"
                : "border-transparent text-(--text-3) hover:text-(--text)",
            )}
          />
        ))}
        <SaveViewDialog workspaceId={workspaceId} projectId={project.id} baseHref={base} defaultType={defaultType} />
      </nav>
    </header>
  );
}
