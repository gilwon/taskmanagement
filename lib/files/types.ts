// 파일 화면 공용 타입. 화면용 파일 한 건과 업로드 준비 결과 형태를 정의한다
import type { Tables } from "@/lib/database.types";

export type FileRow = Tables<"files">;

// 목록에 그리는 파일 한 건. 올린 사람·연결 작업 요약을 붙인다(볼 수 없거나 삭제된 작업은 null)
export type FileItem = Pick<
  FileRow,
  "id" | "project_id" | "task_id" | "name" | "type" | "mime" | "size_bytes" | "status" | "created_at" | "uploaded_by"
> & {
  uploader: { name: string; color: string } | null;
  task: { id: string; key: string; title: string } | null;
};

// 브라우저가 Storage에 직접 올릴 서명 업로드 URL과 서버가 정한 MIME
export type UploadTicket = { file: FileItem; url: string; mime: string };

// 작업에 연결할 때 고르는 작업 한 건
export type LinkableTask = { id: string; key: string; title: string };
