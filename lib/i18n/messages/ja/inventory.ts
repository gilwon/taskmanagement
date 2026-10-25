// 재고 일본어 문구
import type { Messages } from "../types";

export default {
  // 재고 RPC·검사 오류
  errors: {
    insufficientStock: "在庫が足りないため、出庫または移動できません。",
    sameLocation: "移動元と移動先の場所が同じです。",
    duplicateSku: "このSKUはすでに使われています。",
    duplicateName: "この場所名はすでに使われています。",
    locationNotEmpty: "在庫が残っている場所はアーカイブできません。",
    archived: "アーカイブされた項目の数量は変更できません。",
    invalidQty: "数量が正しくありません。",
    notFound: "項目が見つかりません。",
    forbidden: "権限がありません。",
  },
} satisfies Messages["inventory"];
