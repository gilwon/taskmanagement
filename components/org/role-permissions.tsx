// 역할별 권한 표. 읽기 전용이고 구성원 화면의 역할과 권한 탭과 설정의 권한 섹션이 함께 쓴다
import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import { ROLE_PERMISSIONS, type Role } from "@/lib/org/rules";

const ROLES: Role[] = ["owner", "admin", "member", "guest"];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    const Icon = value ? Check : Minus;
    return (
      <span role="img" aria-label={value ? "가능" : "불가"} className={value ? "text-(--green)" : "text-(--text-4)"}>
        <Icon aria-hidden size={16} strokeWidth={1.8} />
      </span>
    );
  }
  return <span className="text-(length:--fs-sm) text-(--text-2)">{value}</span>;
}

export function RolePermissionsTable() {
  return (
    // 좁은 화면에서는 표 안에서만 가로로 넘긴다(페이지는 넘치지 않는다)
    <div className="overflow-x-auto rounded-(--r) border border-(--border)">
      <Table className="text-(length:--fs-base)">
        <caption className="sr-only">역할별 권한</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="min-w-40">
              권한
            </TableHead>
            {ROLES.map((r) => (
              <TableHead key={r} scope="col" className="min-w-24">
                {ROLE_LABELS[r]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROLE_PERMISSIONS.map((p) => (
            <TableRow key={p.label}>
              <TableHead scope="row" className="font-normal whitespace-normal text-(--text)">
                {p.label}
              </TableHead>
              {ROLES.map((r) => (
                <TableCell key={r} className="whitespace-normal">
                  <Cell value={p.allow[r]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
