// 재고 화면. 품목 목록과 위치 탭을 보인다. 필터는 ?q=&cat=&low=1, 탭은 ?tab=locations, 열린 품목은 ?item=<id>
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { InventoryView } from "@/components/inventory/inventory-view";
import { getMember, getWorkspace, requireUserId } from "@/lib/data/workspace";
import { getT } from "@/lib/i18n/server";
import { canAdjustStock, canManageStock, canMoveStock, canUseStock } from "@/lib/inventory/rules";
import { getStockCategories, getStockItemDetail, getStockItems, getStockLocations } from "@/lib/inventory/queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("common.nav.inventory") };
}

type Props = {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ q?: string; cat?: string; low?: string; tab?: string; item?: string }>;
};

export default async function InventoryPage({ params, searchParams }: Props) {
  const [{ ws }, query] = await Promise.all([params, searchParams]);
  const [userId, workspace] = await Promise.all([requireUserId(), getWorkspace(ws)]);
  if (!workspace) notFound();
  const role = (await getMember(ws, userId))?.role ?? null;
  if (!canUseStock(role)) forbidden();

  const q = query.q ?? "";
  const cat = query.cat ?? "";
  const low = query.low === "1";
  const [items, locations, categories, rawDetail] = await Promise.all([
    getStockItems(workspace.id, { q, category: cat || undefined, low }),
    getStockLocations(workspace.id),
    getStockCategories(workspace.id),
    query.item && UUID_RE.test(query.item) ? getStockItemDetail(query.item) : null,
  ]);
  // 보관 품목이거나 다른 워크스페이스 품목이면 목록에 없으므로 무시한다
  const detail = rawDetail && items.some((i) => i.id === rawDetail.item.id) ? rawDetail : null;

  return (
    <InventoryView
      workspace={{ id: workspace.id, slug: workspace.slug, name: workspace.name }}
      items={items}
      locations={locations}
      categories={categories}
      filters={{ q, cat, low }}
      tab={query.tab === "locations" ? "locations" : "items"}
      selectedId={detail?.item.id ?? null}
      detail={detail}
      canManage={canManageStock(role)}
      canMove={canMoveStock(role)}
      canAdjust={canAdjustStock(role)}
    />
  );
}
