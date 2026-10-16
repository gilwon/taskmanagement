// 역할별 권한 표. 읽기 전용이고 구성원 화면의 역할과 권한 탭과 설정의 권한 섹션이 함께 쓴다
import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";
import { ROLE_PERMISSIONS, type PermissionCond, type Role } from "@/lib/org/rules";

const ROLES: Role[] = ["owner", "admin", "member", "guest"];

// label은 아이콘 칸이면 가능·불가, 조건 칸이면 조건 설명이다
function Cell({ value, label }: { value: boolean | string; label: string }) {
  if (typeof value === "boolean") {
    const Icon = value ? Check : Minus;
    return (
      <span role="img" aria-label={label} className={value ? "text-(--green)" : "text-(--text-4)"}>
        <Icon aria-hidden size={16} strokeWidth={1.8} />
      </span>
    );
  }
  return <span className="text-(length:--fs-sm) text-(--text-2)">{label}</span>;
}

export async function RolePermissionsTable() {
  const t = await getT();
  return (
    // 좁은 화면에서는 표 안에서만 가로로 넘긴다(페이지는 넘치지 않는다)
    <div className="overflow-x-auto rounded-(--r) border border-(--border)">
      <Table className="text-(length:--fs-base)">
        <caption className="sr-only">{t("org.permissions.caption")}</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="min-w-40">
              {t("org.permissions.permission")}
            </TableHead>
            {ROLES.map((r) => (
              <TableHead key={r} scope="col" className="min-w-24">
                {t(`common.role.${r}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROLE_PERMISSIONS.map((p) => (
            <TableRow key={p.id}>
              <TableHead scope="row" className="font-normal whitespace-normal text-(--text)">
                {t(`org.permissions.row.${p.id}`)}
              </TableHead>
              {ROLES.map((r) => {
                const v: boolean | PermissionCond = p.allow[r];
                const label =
                  typeof v === "boolean"
                    ? t(v ? "org.permissions.allowed" : "org.permissions.denied")
                    : t(`org.permissions.cond.${v}`);
                return (
                  <TableCell key={r} className="whitespace-normal">
                    <Cell value={v} label={label} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
