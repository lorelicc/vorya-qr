import { ApiError } from "./api";
import { csrfHeaders } from "./auth-client";

export type UploadPurpose = "image" | "cover" | "avatar" | "gallery" | "logo" | "pdf" | "audio";

export type UploadedFile = {
  id: string;
  kind: "image" | "pdf" | "audio";
  purpose: UploadPurpose;
  mime: string;
  original_name: string;
  size_bytes: number;
  page_count: number | null;
  urls: Record<string, string>;
  created_at: string;
};

/** Multipart upload with real progress (XHR: fetch has no upload progress events). */
export function uploadFile<T = UploadedFile>(
  path: string,
  file: File,
  fields: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/${path}`);
    for (const [name, value] of Object.entries(csrfHeaders())) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) =>
      event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onerror = () => reject(new ApiError("Connessione interrotta durante il caricamento.", 0));
    xhr.onload = () => {
      let data: { detail?: string; code?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      reject(
        new ApiError(
          typeof data?.detail === "string" ? data.detail : "Caricamento non riuscito. Riprova.",
          xhr.status,
          data?.code,
        ),
      );
    };
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    form.append("file", file);
    xhr.send(form);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}
