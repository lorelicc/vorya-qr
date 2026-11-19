"use client";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { FolderItem } from "@/lib/types";
import { folderRows } from "./useOrganize";
import styles from "./organize.module.css";

/**
 * Keyboard- and touch-friendly alternative to drag and drop: "Sposta in…".
 * `exclude` hides a folder (and its place) when moving a folder.
 */
export function FolderPicker({
  open,
  title,
  folders,
  allowRoot = true,
  disabled = () => false,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  folders: FolderItem[];
  allowRoot?: boolean;
  disabled?: (folder: FolderItem) => boolean;
  onClose: () => void;
  onPick: (folderId: number | null) => Promise<void> | void;
}) {
  const [choice, setChoice] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button
            loading={busy}
            disabled={choice === undefined}
            onClick={async () => {
              setBusy(true);
              try {
                await onPick(choice ?? null);
                setChoice(undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            Sposta
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Destinazione" className={styles.picker}>
        {allowRoot && (
          <label>
            <input
              type="radio"
              name="dest"
              checked={choice === null}
              onChange={() => setChoice(null)}
            />{" "}
            Nessuna cartella
          </label>
        )}
        {folderRows(folders).map(({ folder, depth }) => (
          <label key={folder.id} style={{ paddingLeft: depth * 20 }}>
            <input
              type="radio"
              name="dest"
              disabled={disabled(folder)}
              checked={choice === folder.id}
              onChange={() => setChoice(folder.id)}
            />{" "}
            {folder.name}
          </label>
        ))}
        {folders.length === 0 && !allowRoot && <p className="muted">Crea prima una cartella.</p>}
      </div>
    </Modal>
  );
}
