// 재고 중국어 간체 문구
import type { Messages } from "../types";

export default {
  // 재고 RPC·검사 오류
  errors: {
    insufficientStock: "库存不足，无法出库或移动。",
    sameLocation: "出发位置与目标位置相同。",
    duplicateSku: "该 SKU 已被使用。",
    duplicateName: "该位置名称已被使用。",
    locationNotEmpty: "仍有库存的位置无法归档。",
    archived: "已归档的项目无法修改数量。",
    invalidQty: "数量不正确。",
    notFound: "找不到该项目。",
    forbidden: "没有权限。",
  },
} satisfies Messages["inventory"];
