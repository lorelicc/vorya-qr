"use client";
import { useMemo, useState } from "react";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import { designForCompany, designOf } from "@/lib/design";
import type { Company, QrCode, QrDesign } from "@/lib/types";
import type { UploadedFile } from "@/lib/upload";
import { cleanPage, defaultPage } from "./pages/defaults";
import { toPageFile } from "./pages/shared";
import { STATIC_DEFAULTS } from "./types/StaticForm";
import { isPageType, type QrTypeKey } from "./types/meta";

export type Draft = {
  qr_type: QrTypeKey | null;
  dynamic: boolean;
  name: string;
  target_url: string;
  static_data: Record<string, string | boolean>;
  page: PageDoc | null;
  design: QrDesign;
};

/** Editor state for every QR type, plus the payload builder sent to the API. */
export function useQrDraft(
  company: Company,
  initial?: QrCode,
  initialPage?: PageDoc | null,
  initialFiles: PageFiles = {},
) {
  const [draft, setDraft] = useState<Draft>(() => ({
    qr_type: (initial?.qr_type as QrTypeKey) ?? null,
    dynamic: initial ? initial.kind === "dynamic" : true,
    name: initial?.name ?? "",
    target_url: initial?.target_url || "https://",
    static_data: (initial?.static_data as Draft["static_data"]) ?? {},
    page: initialPage ?? null,
    design: initial ? designOf(initial) : designForCompany(company),
  }));
  const [files, setFiles] = useState<PageFiles>(initialFiles);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const chooseType = (qr_type: QrTypeKey) =>
    setDraft((d) => ({
      ...d,
      qr_type,
      page: isPageType(qr_type)
        ? d.page?.template === qr_type
          ? d.page
          : defaultPage(qr_type, company)
        : null,
      static_data: {
        ...(STATIC_DEFAULTS[qr_type] ?? {}),
        ...(d.qr_type === qr_type ? d.static_data : {}),
      },
    }));
  const addFile = (file: UploadedFile) =>
    setFiles((all) => ({ ...all, [file.id]: toPageFile(file) }));

  const kind =
    draft.qr_type && (isPageType(draft.qr_type) || (draft.qr_type === "website" && draft.dynamic))
      ? "dynamic"
      : "static";

  const content = useMemo(() => {
    const t = draft.qr_type;
    if (!t) return {};
    if (isPageType(t)) return { page: draft.page ? cleanPage(draft.page) : null };
    if (t === "website" && draft.dynamic) return { target_url: draft.target_url };
    return { static_data: draft.static_data };
  }, [draft]);

  const payload = () => ({ name: draft.name, design: draft.design, ...content });
  const createPayload = () => ({ ...payload(), qr_type: draft.qr_type, dynamic: draft.dynamic });
  const previewPayload = {
    qr_type: draft.qr_type ?? "website",
    dynamic: draft.dynamic,
    ...content,
    design: draft.design,
  };

  return {
    draft,
    update,
    chooseType,
    files,
    addFile,
    kind,
    payload,
    createPayload,
    previewPayload,
  };
}
