// 파일 업로드 규칙 순수 함수. 확장자로 MIME·file_type을 정하고, 표시명·Storage 객체 이름을 다듬고, 크기를 표기한다
import type { Enums } from "@/lib/database.types";

export type FileType = Enums<"file_type">;

// 버킷 file_size_limit, files.size_bytes check와 같은 값(50 MB)
export const MAX_FILE_BYTES = 52_428_800;
export const MAX_FILE_LABEL = "50 MB";

// 확장자 → MIME·형식. MIME은 storage 마이그레이션의 버킷 allowed_mime_types 안에서만 고른다.
// 표에 없는 확장자는 거부한다. SVG·HTML은 스크립트를 담을 수 있어 넣지 않는다
const EXT_RULES: Record<string, { mime: string; type: FileType }> = {
  png: { mime: "image/png", type: "img" },
  jpg: { mime: "image/jpeg", type: "img" },
  jpeg: { mime: "image/jpeg", type: "img" },
  gif: { mime: "image/gif", type: "img" },
  webp: { mime: "image/webp", type: "img" },
  pdf: { mime: "application/pdf", type: "pdf" },
  zip: { mime: "application/zip", type: "zip" },
  doc: { mime: "application/msword", type: "doc" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", type: "doc" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", type: "doc" },
  txt: { mime: "text/plain", type: "doc" },
  md: { mime: "text/plain", type: "other" },
  xls: { mime: "application/vnd.ms-excel", type: "sheet" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", type: "sheet" },
  csv: { mime: "text/csv", type: "sheet" },
  json: { mime: "application/json", type: "code" },
  fig: { mime: "application/x-figma", type: "fig" },
};

// 파일 선택 창 accept 값
export const ACCEPT_ATTR = Object.keys(EXT_RULES)
  .map((e) => `.${e}`)
  .join(",");

// 허용 형식 안내 문구
export const ALLOWED_EXT_LABEL = Object.keys(EXT_RULES).join(", ");

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function ruleFor(name: string) {
  const ext = extOf(name);
  return Object.hasOwn(EXT_RULES, ext) ? EXT_RULES[ext] : null;
}

// files.name check와 같게 다듬는다. 슬래시·역슬래시·제어문자는 '_', 앞뒤 공백 제거, 255자(코드 포인트) 초과면 null
export function normalizeName(raw: string): string | null {
  const name = raw.replace(/[/\\\u0000-\u001f\u007f]/g, "_").trim();
  const len = [...name].length;
  if (len < 1 || len > 255 || name === "." || name === "..") return null;
  return name;
}

// Storage 객체 이름. 로컬 Storage가 한글 키를 거부하므로 ASCII [A-Za-z0-9._-]만 남긴다(1~128자)
export function toObjectName(name: string): string {
  const ext = extOf(name).replace(/[^a-z0-9]/g, "");
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 100);
  return `${base || "file"}${ext ? `.${ext.slice(0, 20)}` : ""}`;
}

export type UploadCheck =
  | { ok: true; name: string; mime: string; type: FileType; objectName: string }
  | { ok: false; error: string };

// 업로드 전 검사. 브라우저와 서버 액션이 같은 함수를 쓴다(브라우저가 알려 주는 MIME은 믿지 않는다)
export function checkUpload(rawName: string, size: number): UploadCheck {
  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: "파일 이름을 확인해 주세요. 1~255자여야 합니다." };
  if (!Number.isSafeInteger(size) || size < 1) return { ok: false, error: `빈 파일은 올릴 수 없습니다. (${name})` };
  if (size > MAX_FILE_BYTES) {
    return { ok: false, error: `파일당 최대 ${MAX_FILE_LABEL}까지 올릴 수 있습니다. (${name})` };
  }
  const rule = ruleFor(name);
  if (!rule) return { ok: false, error: `지원하지 않는 형식입니다. (${name})` };
  return { ok: true, name, mime: rule.mime, type: rule.type, objectName: toObjectName(name) };
}

// "820 B", "12.3 KB", "2.4 MB". 1024 단위
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
