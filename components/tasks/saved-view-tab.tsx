"use client";
// 프로젝트 머리말의 저장 뷰 탭. 우클릭·Shift+F10 메뉴로 열기와 링크 복사를 준다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { KeyContextMenu, copyText } from "@/components/shortcuts/key-context-menu";
import { useT } from "@/lib/i18n/client";

export function SavedViewTab({
  href,
  name,
  current,
  className,
}: {
  href: string;
  name: string;
  current: boolean;
  className: string;
}) {
  const t = useT();
  const router = useRouter();
  return (
    <KeyContextMenu
      label={t("tasks.savedView.menu", { name })}
      menu={
        <>
          <ContextMenuItem onSelect={() => router.push(href)}>{t("tasks.savedView.open")}</ContextMenuItem>
          <ContextMenuItem onSelect={() => void copyText(`${window.location.origin}${href}`, t("tasks.savedView.linkNoun"), t)}>
            {t("tasks.savedView.copyLink")}
          </ContextMenuItem>
        </>
      }
    >
      <Link href={href} aria-current={current ? "page" : undefined} className={className}>
        <span className="truncate">{name}</span>
      </Link>
    </KeyContextMenu>
  );
}
