// 재고 영어 문구
import type { Messages } from "../types";

export default {
  // 재고 RPC·검사 오류
  errors: {
    insufficientStock: "Not enough stock to ship or move.",
    sameLocation: "The source and destination locations are the same.",
    duplicateSku: "This SKU is already in use.",
    duplicateName: "This location name is already in use.",
    locationNotEmpty: "A location that still holds stock cannot be archived.",
    archived: "Archived items cannot have their quantity changed.",
    invalidQty: "The quantity is not valid.",
    notFound: "Item not found.",
    forbidden: "You do not have permission.",
  },
} satisfies Messages["inventory"];
