"use client";
// 품목 서랍. 위치별 수량과 이동 이력을 보이고 입고·출고·이동·조정·수정·보관 동작을 연다. 열림은 주소의 ?item=<id>가 원본이다
import { Archive, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, Pencil } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { HistoryFilterBar } from "@/components/inventory/history-filter";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import type { InventoryDetail } from "@/components/inventory/inventory-view";
import type { Navigate } from "@/components/inventory/item-table";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import { StatusBadge } from "@/components/inventory/status-badge";
import { useInventory } from "@/components/inventory/use-inventory";
import { ConfirmDialog } from "@/components/org/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatter, useT } from "@/lib/i18n/client";
import { setStockItemArchived } from "@/lib/inventory/actions";
import { stockStatus, sumLevels, type HistoryFilter } from "@/lib/inventory/rules";
import type { StockLocation, StockMovement, StockMovementKind } from "@/lib/inventory/types";

type Props = {
  detail: InventoryDetail;
  // 주소에서 검증된 이력 필터
  historyFilter: HistoryFilter;
  // 보관되지 않은 위치
  locations: StockLocation[];
  // 보관 위치까지 포함한 id별 이름. 이력 표시용
  locationNames: Record<string, string>;
  categories: string[];
  workspaceId: string;
  canMove: boolean;
  canAdjust: boolean;
  canManage: boolean;
  navigate: Navigate;
};

const KIND_ICON = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  adjust: ClipboardCheck,
} as const;
const KIND_TITLE = {
  in: "inventory.movement.titleIn",
  out: "inventory.movement.titleOut",
  transfer: "inventory.movement.titleTransfer",
  adjust: "inventory.movement.titleAdjust",
} as const;
const KIND_LABEL = {
  in: "inventory.kind.in",
  out: "inventory.kind.out",
  transfer: "inventory.kind.transfer",
  adjust: "inventory.kind.adjust",
} as const;
// 줄 왼쪽 색 막대와 라벨 배지 색. 이동·조정은 중립이다
const KIND_BAR = {
  in: "border-l-(--blue)",
  out: "border-l-(--red)",
  transfer: "border-l-transparent",
  adjust: "border-l-transparent",
} as const;
const KIND_BADGE = {
  // --blue-soft 토큰이 없어 --red-soft와 같은 농도로 직접 섞는다
  in: "bg-[color-mix(in_srgb,var(--blue)_10%,transparent)]",
  out: "bg-(--red-soft)",
  transfer: "bg-muted",
  adjust: "bg-muted",
} as const;
// 입고는 파랑(글자는 대비를 위해 한 단계 진한 --sat-ink), 출고는 빨강이고 부호를 함께 쓴다. 이동·조정은 중립 색이고 조정은 차이의 부호를 수량에 붙인다
const KIND_TONE = { in: "text-(--sat-ink)", out: "text-(--red)", transfer: "text-(--text)", adjust: "text-(--text)" } as const;

export function ItemDrawer({
  detail,
  historyFilter,
  locations,
  locationNames,
  categories,
  workspaceId,
  canMove,
  canAdjust,
  canManage,
  navigate,
}: Props) {
  const t = useT();
  const f = useFormatter();
  const { run } = useInventory();
  const { item, levels, movements } = detail;
  const [open, setOpen] = useState(true);
  const [moving, setMoving] = useState<StockMovementKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // 상대 시간 기준 시각. 렌더마다 바뀌면 서버·클라이언트 출력이 어긋나므로 처음 한 번만 잡는다
  const [now] = useState(() => new Date());

  // 닫을 때 포커스를 돌려줄 곳. Radix가 포커스를 가져가기 전에 연 요소를 기억한다
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    opener.current = active && active !== document.body ? active : null;
  }, []);

  const total = sumLevels(levels);
  const status = stockStatus(total, item.safetyStock);
  const noLocation = locations.length === 0;
  const filtered = Boolean(historyFilter.kind || historyFilter.from || historyFilter.to);
  const invalidRange = Boolean(historyFilter.from && historyFilter.to && historyFilter.from > historyFilter.to);
  const nameOf = (id: string) => locationNames[id] ?? t("inventory.history.unknownLocation");
  const stocked = levels
    .filter((l) => l.qty > 0)
    .sort((a, b) => nameOf(a.locationId).localeCompare(nameOf(b.locationId)));

  const close = () => {
    setOpen(false);
    navigate({ item: null }, "replace");
  };

  // 이동 종류별 버튼. 출고·이동은 합계가 0이면 쓸 수 없다
  const buttons: { kind: StockMovementKind; show: boolean; needStock: boolean }[] = [
    { kind: "in", show: canMove, needStock: false },
    { kind: "out", show: canMove, needStock: true },
    { kind: "transfer", show: canMove, needStock: true },
    { kind: "adjust", show: canAdjust, needStock: false },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && close()}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            (opener.current?.isConnected ? opener.current : document.getElementById("main-content"))?.focus();
          }}
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
        >
          <SheetHeader className="gap-1.5 border-b border-(--border) p-4 pr-12">
            <SheetTitle className="text-(length:--fs-lg) leading-snug break-words">{item.name}</SheetTitle>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-(length:--fs-sm) text-(--text-2)">
              <span className="font-mono">{item.sku}</span>
              {item.category && <span>· {item.category}</span>}
              <StatusBadge status={status} />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <dl className="grid grid-cols-2 gap-4 border-b border-(--border) p-4">
              <div>
                <dt className="text-(length:--fs-xs) text-(--text-3)">{t("inventory.drawer.onHand")}</dt>
                <dd className="text-(length:--fs-2xl) font-medium text-(--text) tabular-nums">
                  {f.number(total)} <span className="text-(length:--fs-base) font-normal text-(--text-3)">{item.unit}</span>
                </dd>
              </div>
              <div>
                <dt className="text-(length:--fs-xs) text-(--text-3)">{t("inventory.drawer.safety")}</dt>
                <dd className="text-(length:--fs-2xl) font-medium text-(--text-2) tabular-nums">
                  {f.number(item.safetyStock)}{" "}
                  <span className="text-(length:--fs-base) font-normal text-(--text-3)">{item.unit}</span>
                </dd>
              </div>
            </dl>

            <div className="grid gap-2 border-b border-(--border) p-4">
              <div role="group" aria-label={t("inventory.drawer.actions")} className="flex flex-wrap gap-2">
                {buttons
                  .filter((b) => b.show)
                  .map(({ kind, needStock }) => {
                    const Icon = KIND_ICON[kind];
                    return (
                      <Button
                        key={kind}
                        variant="outline"
                        className="max-sm:h-10"
                        disabled={noLocation || (needStock && total <= 0)}
                        onClick={() => setMoving(kind)}
                      >
                        <Icon aria-hidden strokeWidth={1.8} />
                        {t(KIND_TITLE[kind])}
                      </Button>
                    );
                  })}
                {canManage && (
                  <>
                    <Button variant="ghost" className="max-sm:h-10 sm:ml-auto" onClick={() => setEditing(true)}>
                      <Pencil aria-hidden strokeWidth={1.8} />
                      {t("inventory.drawer.edit")}
                    </Button>
                    <Button variant="ghost" className="max-sm:h-10" onClick={() => setArchiving(true)}>
                      <Archive aria-hidden strokeWidth={1.8} />
                      {t("inventory.drawer.archive")}
                    </Button>
                  </>
                )}
              </div>
              {canMove && noLocation && (
                <p className="flex flex-wrap items-center gap-x-2 text-(length:--fs-sm) text-(--text-2)">
                  {t("inventory.drawer.needLocation")}
                  <Button
                    variant="link"
                    className="h-auto p-0 max-sm:min-h-10"
                    onClick={() => navigate({ tab: "locations", item: null }, "push")}
                  >
                    {t("inventory.drawer.goLocations")}
                  </Button>
                </p>
              )}
              {canMove && !noLocation && total <= 0 && (
                <p className="text-(length:--fs-sm) text-(--text-2)">{t("inventory.drawer.noQty")}</p>
              )}
            </div>

            <section aria-labelledby="inventory-levels-title" className="border-b border-(--border) p-4">
              <h3 id="inventory-levels-title" className="mb-2 text-(length:--fs-md) font-medium text-(--text)">
                {t("inventory.drawer.byLocation")}
              </h3>
              {stocked.length === 0 ? (
                <p className="text-(length:--fs-base) text-(--text-2)">{t("inventory.drawer.noStock")}</p>
              ) : (
                <Table className="text-(length:--fs-base)">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.drawer.colLocation")}</TableHead>
                      <TableHead className="text-right">{t("inventory.drawer.colQty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stocked.map((l) => (
                      <TableRow key={l.locationId} className="h-(--row-h) max-sm:h-12">
                        <TableCell className="text-(--text)">{nameOf(l.locationId)}</TableCell>
                        <TableCell className="text-right text-(--text) tabular-nums">
                          {f.number(l.qty)} <span className="text-(--text-3)">{item.unit}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section aria-labelledby="inventory-history-title" className="p-4">
              <h3 id="inventory-history-title" className="mb-2 text-(length:--fs-md) font-medium text-(--text)">
                {t("inventory.history.title")}
              </h3>
              <HistoryFilterBar filter={historyFilter} filtered={filtered} navigate={navigate} />
              {movements.length === 0 && filtered ? (
                <div>
                  <p className="text-(length:--fs-base) text-(--text-2)">{t("inventory.history.filter.noMatch")}</p>
                  <p className="text-(length:--fs-sm) text-(--text-3)">
                    {t(invalidRange ? "inventory.history.filter.invalidRange" : "inventory.history.filter.noMatchHint")}
                  </p>
                </div>
              ) : movements.length === 0 ? (
                <div>
                  <p className="text-(length:--fs-base) text-(--text-2)">{t("inventory.history.empty")}</p>
                  <p className="text-(length:--fs-sm) text-(--text-3)">{t("inventory.history.emptyHint")}</p>
                </div>
              ) : (
                <>
                  <ol aria-label={t("inventory.history.list")} className="divide-y divide-(--border) rounded-(--r-sm) border border-(--border)">
                    {movements.map((m) => (
                      <HistoryRow key={m.id} m={m} unit={item.unit} nameOf={nameOf} now={now} />
                    ))}
                  </ol>
                  {movements.length >= 100 && (
                    <p className="mt-2 text-(length:--fs-xs) text-(--text-3)">
                      {t("inventory.history.limit", { count: movements.length })}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {moving && (
        <MovementDialog kind={moving} item={item} levels={levels} locations={locations} onClose={() => setMoving(null)} />
      )}
      {canManage && (
        <>
          <ItemFormDialog
            open={editing}
            onOpenChange={setEditing}
            workspaceId={workspaceId}
            categories={categories}
            item={item}
          />
          <ConfirmDialog
            open={archiving}
            onOpenChange={setArchiving}
            title={t("inventory.drawer.archiveTitle")}
            description={t("inventory.drawer.archiveDescription", { name: item.name })}
            confirmLabel={t("inventory.drawer.archive")}
            onConfirm={async () => {
              const r = await run(() => setStockItemArchived(item.id, true), t("inventory.toast.itemArchived"));
              if (!r.ok) return r.error || null;
              close();
              return null;
            }}
          />
        </>
      )}
    </>
  );
}

// 이력 한 줄. 종류는 아이콘·라벨·수량 부호로 함께 구분한다(색만으로 구분하지 않는다)
function HistoryRow({
  m,
  unit,
  nameOf,
  now,
}: {
  m: StockMovement;
  unit: string;
  nameOf: (id: string) => string;
  now: Date;
}) {
  const t = useT();
  const f = useFormatter();
  const Icon = KIND_ICON[m.kind];
  const sign = m.kind === "in" ? "+" : m.kind === "out" ? "−" : m.kind === "adjust" ? (m.qty > 0 ? "+" : "−") : "";
  const place =
    m.kind === "transfer" && m.toLocationId
      ? t("inventory.history.route", { from: nameOf(m.locationId), to: nameOf(m.toLocationId) })
      : nameOf(m.locationId);

  return (
    <li
      className={`grid gap-1 border-l-[3px] px-3 py-2.5 transition-colors ease-(--ux-ease) hover:bg-muted/50 ${KIND_BAR[m.kind]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-(length:--fs-sm) font-medium ${KIND_TONE[m.kind]} ${KIND_BADGE[m.kind]}`}
        >
          <Icon aria-hidden size={14} strokeWidth={1.8} className={KIND_TONE[m.kind]} />
          {t(KIND_LABEL[m.kind])}
        </span>
        <span className={`text-(length:--fs-md) font-medium tabular-nums ${KIND_TONE[m.kind]}`}>
          {sign}
          {f.number(Math.abs(m.qty))} <span className="text-(length:--fs-sm) font-normal text-(--text-3)">{unit}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-(length:--fs-sm) text-(--text-2)">
        <span className="min-w-0 break-words">{place}</span>
        <span className="tabular-nums">{t("inventory.history.balance", { qty: m.balanceAfter, unit })}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 text-(length:--fs-xs) text-(--text-3)">
        <span>{m.actorName ?? t("inventory.history.unknownActor")}</span>
        <span aria-hidden>·</span>
        <time dateTime={m.createdAt}>
          {f.dateTime(m.createdAt)} · {f.relative(m.createdAt, now)}
        </time>
      </div>
      {m.note && <p className="text-(length:--fs-sm) break-words text-(--text-2)">{m.note}</p>}
    </li>
  );
}
