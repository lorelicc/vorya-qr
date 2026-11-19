"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { FolderItem, TagItem } from "@/lib/types";

/** Folders and tags of the current company, with the mutations the dashboard needs. */
export function useOrganize() {
  const { api: base } = useCompany();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [unfiled, setUnfiled] = useState(0);
  const [tags, setTags] = useState<TagItem[]>([]);

  const reload = useCallback(() => {
    api<{ folders: FolderItem[]; unfiled: number }>(`${base}/folders`)
      .then((r) => {
        setFolders(r.folders);
        setUnfiled(r.unfiled);
      })
      .catch(() => undefined);
    api<TagItem[]>(`${base}/tags`)
      .then(setTags)
      .catch(() => undefined);
  }, [base]);
  useEffect(reload, [reload]);

  return {
    folders,
    unfiled,
    tags,
    reload,
    createFolder: async (name: string, parent_id: number | null) => {
      await api(`${base}/folders`, "POST", { name, parent_id });
      reload();
    },
    renameFolder: async (id: number, name: string) => {
      await api(`${base}/folders/${id}`, "PUT", { name });
      reload();
    },
    moveFolder: async (id: number, parent_id: number | null) => {
      await api(`${base}/folders/${id}`, "PUT", { move: true, parent_id });
      reload();
    },
    deleteFolder: async (id: number) => {
      await api(`${base}/folders/${id}`, "DELETE");
      reload();
    },
    createTag: async (name: string, color: string) => {
      await api(`${base}/tags`, "POST", { name, color });
      reload();
    },
    deleteTag: async (id: number) => {
      await api(`${base}/tags/${id}`, "DELETE");
      reload();
    },
  };
}

export type Organize = ReturnType<typeof useOrganize>;

/** Folders as an ordered tree: roots first, each followed by its sub-folders. */
export function folderRows(folders: FolderItem[]): { folder: FolderItem; depth: 0 | 1 }[] {
  const roots = folders.filter((f) => f.parent_id === null);
  return roots.flatMap((root) => [
    { folder: root, depth: 0 as const },
    ...folders
      .filter((f) => f.parent_id === root.id)
      .map((f) => ({ folder: f, depth: 1 as const })),
  ]);
}
