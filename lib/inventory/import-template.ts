// 재고 엑셀 업로드 양식(.xlsx)을 브라우저에서 만들어 내려받는다. 클라이언트에서만 부른다

// 머리글은 한글 고정이다. 파서는 영문 별칭도 받는다
const HEADERS = ["SKU", "품목명", "단위", "카테고리", "안전재고", "위치", "수량"];
const EXAMPLE = ["PAPER-A4", "A4 복사용지", "박스", "사무용품", 10, "본사 창고", 50];

export async function downloadImportTemplate(): Promise<void> {
  // 브라우저 번들에 처음부터 싣지 않도록 눌렀을 때 불러온다
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile([HEADERS, EXAMPLE]).toFile("inventory-import-template.xlsx");
}
