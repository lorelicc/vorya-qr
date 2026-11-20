"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useDndFx } from "./dndFx";
import { Folder, FolderInput, FolderPlus, Inbox, Layers, MoreHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { NoFolder } from "@/components/illustrations";
import { Button, Input, Menu, MenuItem, Modal, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import type { FolderItem } from "@/lib/types";
import { FolderPicker } from "./FolderPicker";
import { folderRows, type Organize } from "./useOrganize";
import styles from "./organize.module.css";

export type FolderFilter = "" | "none" | string; // "" = all, "none" = unfiled, else a folder id

function Row({
  id,
  active,
  depth = 0,
  icon,
  label,
  count,
  onClick,
  draggableId,
  children,
}: {
  id: string; // droppable id
  active: boolean;
  depth?: number;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
  draggableId?: string;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const fx = useDndFx();
  const drag = useDraggable({ id: draggableId ?? `unused-${id}`, disabled: !draggableId });
  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        drag.setNodeRef(node);
      }}
      className={styles.folderRow}
      data-active={active || undefined}
      data-over={isOver || undefined}
      data-armed={(fx.dragging && !isOver) || undefined}
      data-received={fx.received === id || undefined}
      data-dragging={drag.isDragging || undefined}
      style={{ paddingLeft: 8 + depth * 18 }}
    >
      <button
        type="button"
        className={styles.folderButton}
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        {...(draggableId ? { ...drag.attributes, ...drag.listeners } : {})}
      >
        {icon}
        <span>{label}</span>
        <small>{count}</small>
      </button>
      {children}
    </li>
  );
}

/** Folder tree (2 levels). Rows are drop targets for links and folders; menus are the
 * keyboard/mobile alternative ("Sposta in…"). */
export function FolderTree({
  org,
  value,
  total,
  onChange,
}: {
  org: Organize;
  value: FolderFilter;
  total: number;
  onChange: (value: FolderFilter) => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState<{ parent: FolderItem | null } | null>(null);
  const [renaming, setRenaming] = useState<FolderItem | null>(null);
  const [moving, setMoving] = useState<FolderItem | null>(null);
  const [deleting, setDeleting] = useState<FolderItem | null>(null);
  const [name, setName] = useState("");

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    await run(async () => {
      if (renaming) await org.renameFolder(renaming.id, value);
      else await org.createFolder(value, creating?.parent?.id ?? null);
      setName("");
      setCreating(null);
      setRenaming(null);
    });
  }

  const rows = folderRows(org.folders);
  return (
    <nav className={styles.tree} aria-label="Cartelle">
      <div className={styles.treeHeader}>
        <h2>Cartelle</h2>
        <button
          type="button"
          aria-label="Nuova cartella"
          title="Nuova cartella"
          onClick={() => {
            setName("");
            setCreating({ parent: null });
          }}
        >
          <FolderPlus size={16} />
        </button>
      </div>
      <ul>
        <Row
          id="folder-all"
          active={value === ""}
          icon={<Layers size={16} aria-hidden="true" />}
          label="Tutti"
          count={total}
          onClick={() => onChange("")}
        />
        <Row
          id="folder-none"
          active={value === "none"}
          icon={<Inbox size={16} aria-hidden="true" />}
          label="Senza cartella"
          count={org.unfiled}
          onClick={() => onChange("none")}
        />
        {rows.map(({ folder, depth }) => (
          <Row
            key={folder.id}
            id={`folder-${folder.id}`}
            draggableId={`dragfolder-${folder.id}`}
            depth={depth}
            active={value === String(folder.id)}
            icon={<Folder size={16} aria-hidden="true" />}
            label={folder.name}
            count={folder.link_count}
            onClick={() => onChange(String(folder.id))}
          >
            <Menu
              label={`Azioni per la cartella ${folder.name}`}
              trigger={(props) => (
                <button
                  type="button"
                  className={styles.folderMenu}
                  aria-label={`Azioni per la cartella ${folder.name}`}
                  {...props}
                >
                  <MoreHorizontal size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  {depth === 0 && (
                    <MenuItem
                      onSelect={() => {
                        close();
                        setName("");
                        setCreating({ parent: folder });
                      }}
                    >
                      Nuova sotto-cartella
                    </MenuItem>
                  )}
                  <MenuItem
                    onSelect={() => {
                      close();
                      setName(folder.name);
                      setRenaming(folder);
                    }}
                  >
                    Rinomina
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      close();
                      setMoving(folder);
                    }}
                  >
                    <FolderInput size={14} aria-hidden="true" /> Sposta in…
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      close();
                      setDeleting(folder);
                    }}
                  >
                    Elimina
                  </MenuItem>
                </>
              )}
            </Menu>
          </Row>
        ))}
      </ul>
      {org.folders.length === 0 && (
        <div className={styles.treeEmpty}>
          <NoFolder />
          <p className="muted">Raggruppa link e QR in cartelle.</p>
        </div>
      )}

      <Modal
        open={creating !== null || renaming !== null}
        title={
          renaming
            ? "Rinomina la cartella"
            : creating?.parent
              ? `Nuova sotto-cartella di ${creating.parent.name}`
              : "Nuova cartella"
        }
        onClose={() => {
          setCreating(null);
          setRenaming(null);
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(null);
                setRenaming(null);
              }}
            >
              Annulla
            </Button>
            <Button type="submit" form="folder-form" disabled={!name.trim()}>
              Salva
            </Button>
          </>
        }
      >
        <form id="folder-form" onSubmit={submit}>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </form>
      </Modal>

      <FolderPicker
        open={moving !== null}
        title={`Sposta «${moving?.name ?? ""}» in…`}
        folders={org.folders.filter((f) => f.parent_id === null && f.id !== moving?.id)}
        onClose={() => setMoving(null)}
        disabled={() => Boolean(moving && org.folders.some((f) => f.parent_id === moving.id))}
        onPick={(parent) =>
          run(async () => {
            if (moving) await org.moveFolder(moving.id, parent);
            setMoving(null);
          })
        }
      />

      <Modal
        open={deleting !== null}
        title="Eliminare la cartella?"
        onClose={() => setDeleting(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                run(async () => {
                  if (deleting) await org.deleteFolder(deleting.id);
                  if (deleting && value === String(deleting.id)) onChange("");
                  setDeleting(null);
                })
              }
            >
              Elimina
            </Button>
          </>
        }
      >
        <p>I link e i QR dentro «{deleting?.name}» non vengono eliminati: salgono di un livello.</p>
      </Modal>
    </nav>
  );
}
