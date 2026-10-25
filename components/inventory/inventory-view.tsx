"use client";
// 재고 화면 본문. 머리말과 "품목"/"위치" 탭을 그린다. 탭·필터·열린 품목은 주소 쿼리가 원본이다.
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ItemDrawer } from "@/components/inventory/item-drawer";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemTable, type Navigate, type StockFilters } from "@/components/inventory/item-table";
import { LocationsPanel } from "@/components/inventory/locations-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/client";
import type { StockItem, StockItemRow, StockLevel, StockLocation, StockMovement } from "@/lib/inventory/types";

export type InventoryDetail = { item: StockItem; levels: StockLevel[]; movements: StockMovement[] };

type Props = {
  workspace: { id: string; slug: string; name: string };
  items: StockItemRow[];
  locations: StockLocation[];
  // 보관 위치까지 포함한 id별 이름. 서랍 이력 표시용
  locationNames: Record<string, string>;
  categories: string[];
  filters: StockFilters;
  tab: "items" | "locations";
  selectedId: string | null;
  detail: InventoryDetail | null;
  canManage: boolean;
  canMove: boolean;
  canAdjust: boolean;
};

export function InventoryView({
  workspace,
  items,
  locations,
  locationNames,
  categories,
  filters,
  tab,
  selectedId,
  detail,
  canManage,
  canMove,
  canAdjust,
}: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [adding, setAdding] = useState(false);

  // 다른 쿼리는 유지한 채 patch만 반영한다
  const navigate = useCallback<Navigate>(
    (patch, mode = "push") => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "replace") router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, search],
  );

  return (
    <>
      <PageHeader
        title={t("common.nav.inventory")}
        subtitle={t("inventory.page.subtitle")}
        actions={
          canManage && (
            <Button size="sm" className="max-sm:h-10" onClick={() => setAdding(true)}>
              <Plus aria-hidden strokeWidth={1.8} />
              {t("inventory.page.addItem")}
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ tab: v === "locations" ? "locations" : null }, "replace")}
        className="gap-(--s-3)"
      >
        <div className="px-(--gutter)">
          <TabsList aria-label={t("inventory.tab.label")} className="max-sm:h-10">
            <TabsTrigger value="items">{t("inventory.tab.items")}</TabsTrigger>
            <TabsTrigger value="locations">{t("inventory.tab.locations")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="items">
          <ItemTable
            items={items}
            categories={categories}
            filters={filters}
            selectedId={selectedId}
            canManage={canManage}
            onAdd={() => setAdding(true)}
            navigate={navigate}
          />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsPanel workspaceId={workspace.id} locations={locations} canManage={canManage} />
        </TabsContent>
      </Tabs>
      {detail && (
        <ItemDrawer
          key={detail.item.id}
          detail={detail}
          locations={locations}
          locationNames={locationNames}
          categories={categories}
          workspaceId={workspace.id}
          canMove={canMove}
          canAdjust={canAdjust}
          canManage={canManage}
          navigate={navigate}
        />
      )}
      {canManage && (
        <ItemFormDialog open={adding} onOpenChange={setAdding} workspaceId={workspace.id} categories={categories} />
      )}
    </>
  );
}
