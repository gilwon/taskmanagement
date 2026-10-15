"use client";
// 새 프로젝트 대화상자 전역 실행기. 워크스페이스 레이아웃에 한 번 두고 useNewProject().openNewProject()로 연다.
// 만들면 프로젝트 개요로 이동하고, Server Action의 refresh가 사이드바 프로젝트 목록을 다시 그린다
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { createProject, loadLeadOptions } from "@/lib/projects/actions";
import type { WorkspaceMember } from "@/lib/tasks/types";

type Ctx = { openNewProject: () => void };

const LauncherContext = createContext<Ctx | null>(null);

export function useNewProject(): Ctx {
  const ctx = useContext(LauncherContext);
  if (!ctx) throw new Error("useNewProject는 NewProjectLauncher 안에서만 쓸 수 있습니다");
  return ctx;
}

// 메뉴 항목에서 열었으면 메뉴가 닫히며 사라지므로 메뉴를 연 버튼으로 포커스를 돌린다
function currentOpener(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest("[role=menu]")) {
    return document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]');
  }
  return active;
}

type Props = {
  workspace: { id: string; slug: string; name: string };
  meId: string;
  children: React.ReactNode;
};

export function NewProjectLauncher({ workspace, meId, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const r = await loadLeadOptions(workspace.id);
    if (r.ok) setMembers(r.data);
    else setLoadError(r.error);
  }, [workspace.id]);

  const ctx = useMemo<Ctx>(
    () => ({
      openNewProject() {
        opener.current = currentOpener();
        setOpen(true);
        void load();
      },
    }),
    [load],
  );

  return (
    <LauncherContext.Provider value={ctx}>
      {children}
      <NewProjectDialog
        open={open}
        onOpenChange={setOpen}
        finalFocus={opener}
        workspaceName={workspace.name}
        meId={meId}
        members={members ?? (loadError ? [] : null)}
        loadError={loadError}
        onRetry={() => void load()}
        onCreate={async (input) => {
          const r = await createProject({ ...input, workspaceId: workspace.id });
          if (!r.ok) return r.error;
          // 이동하면 포커스를 돌려줄 버튼이 사라질 수 있다. 새 화면의 본문 건너뛰기 흐름을 따른다
          opener.current = null;
          toast.success(`${r.data.key} 프로젝트를 만들었습니다`);
          router.push(`/${workspace.slug}/projects/${encodeURIComponent(r.data.key)}/overview`);
          return null;
        }}
      />
    </LauncherContext.Provider>
  );
}
