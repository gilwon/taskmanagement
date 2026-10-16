// 앱 전체 403. 셸 밖에서 forbidden()이 호출되면 현재 로캘 안내와 홈 링크를 보인다
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shell/error-state";
import { getT } from "@/lib/i18n/server";

export default async function Forbidden() {
  const t = await getT();
  return (
    <main className="flex flex-1 flex-col justify-center">
      <ErrorState
        kind="forbidden"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("common.action.home")}</Link>
          </Button>
        }
      />
    </main>
  );
}
