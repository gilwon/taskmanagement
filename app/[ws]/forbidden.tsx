// 워크스페이스 안에서 권한이 없는 화면에 들어왔을 때 셸 안에 보이는 403
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shell/error-state";
import { getT } from "@/lib/i18n/server";

export default async function WorkspaceForbidden() {
  const t = await getT();
  return (
    <div className="pt-(--s-12)">
      <ErrorState
        kind="forbidden"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("common.action.home")}</Link>
          </Button>
        }
      />
    </div>
  );
}
