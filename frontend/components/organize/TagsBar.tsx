"use client";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import type { TagItem } from "@/lib/types";
import type { Organize } from "./useOrganize";
import styles from "./organize.module.css";

const PALETTE = ["#087f5b", "#4b3fa0", "#b42334", "#8a5a00", "#0b6bcb", "#6b7280"];

/** Small coloured tag labels (colour + name: never colour alone). */
export function TagDots({ tags, ids }: { tags: TagItem[]; ids: number[] | undefined }) {
  const mine = tags.filter((t) => ids?.includes(t.id));
  if (!mine.length) return null;
  return (
    <span className={styles.tagList}>
      {mine.map((t) => (
        <span key={t.id} className={styles.tag} style={{ ["--tag" as string]: t.color }}>
          {t.name}
        </span>
      ))}
    </span>
  );
}

/** Filter chips (a link must have all the selected tags) and the tag manager. */
export function TagsBar({
  org,
  selected,
  onChange,
}: {
  org: Organize;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toast = useToast();
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      await org.createTag(name.trim(), color);
      setName("");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className={styles.tagsBar} role="group" aria-label="Filtra per tag">
      <TagIcon size={14} aria-hidden="true" />
      {org.tags.map((t) => (
        <button
          key={t.id}
          type="button"
          className={styles.tagChip}
          aria-pressed={selected.includes(t.id)}
          style={{ ["--tag" as string]: t.color }}
          onClick={() =>
            onChange(
              selected.includes(t.id) ? selected.filter((i) => i !== t.id) : [...selected, t.id],
            )
          }
        >
          {t.name} <small>{t.link_count}</small>
        </button>
      ))}
      <button type="button" className={styles.tagManage} onClick={() => setManaging(true)}>
        <Plus size={14} aria-hidden="true" /> {org.tags.length ? "Gestisci tag" : "Crea un tag"}
      </button>
      <Modal
        open={managing}
        title="Tag"
        onClose={() => setManaging(false)}
        actions={<Button onClick={() => setManaging(false)}>Chiudi</Button>}
      >
        <div className="stack">
          <form onSubmit={add} className={styles.tagForm}>
            <Input
              label="Nuovo tag"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <div role="radiogroup" aria-label="Colore" className={styles.swatches}>
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <Button type="submit" disabled={!name.trim()}>
              Aggiungi
            </Button>
          </form>
          <ul className={styles.tagManager}>
            {org.tags.map((t) => (
              <li key={t.id}>
                <span className={styles.tag} style={{ ["--tag" as string]: t.color }}>
                  {t.name}
                </span>
                <small className="muted">{t.link_count} elementi</small>
                <button
                  type="button"
                  aria-label={`Elimina il tag ${t.name}`}
                  onClick={() =>
                    org.deleteTag(t.id).catch((err) => toast.show(errorMessage(err), "error"))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
