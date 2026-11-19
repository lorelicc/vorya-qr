"use client";
import { useState } from "react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { ImageField } from "@/components/qr/pages/shared";
import { TextArea } from "@/components/qr/types/StaticForm";
import {
  ALLERGENS, BADGES, type Lang, type MenuItem, type MenuSection,
  type WineInfo, type PageFiles,
} from "@/lib/page-types"; // prettier-ignore
import type { UploadedFile } from "@/lib/upload";
import { ALLERGEN_META, BADGE_META } from "./allergens";
import styles from "./menu-editor.module.css";

const EMPTY_WINE: WineInfo = {
  producer: "", appellation: "", denomination: "", vintage: null, grapes: [], area: "",
  price_glass: null, price_bottle: null,
}; // prettier-ignore

/** Full editor of one item, as a bottom sheet on phones. */
export function ItemSheet({
  item,
  section,
  languages,
  files,
  addFile,
  onClose,
  onSave,
}: {
  item: MenuItem;
  section: MenuSection;
  languages: Lang[];
  files: PageFiles;
  addFile: (file: UploadedFile) => void;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}) {
  const [draft, setDraft] = useState<MenuItem>(item);
  const [lang, setLang] = useState<Lang>("it");
  const set = (patch: Partial<MenuItem>) => setDraft((d) => ({ ...d, ...patch }));
  const wine = draft.wine ?? EMPTY_WINE;
  const setWine = (patch: Partial<WineInfo>) => set({ wine: { ...wine, ...patch } });
  const isWine = section.kind === "wine";
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <Modal
      open
      title={draft.name.it ? `Modifica «${draft.name.it}»` : "Nuova voce"}
      onClose={onClose}
      size="md"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={!draft.name.it.trim()}
            onClick={() => onSave({ ...draft, wine: isWine ? wine : null })}
          >
            Salva voce
          </Button>
        </>
      }
    >
      <div className="stack">
        {languages.length > 1 && (
          <div className={styles.langTabs} role="radiogroup" aria-label="Lingua del testo">
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => setLang(l)}
              >
                {l === "it" ? "Italiano" : "English"}
              </button>
            ))}
          </div>
        )}
        <Input
          label={lang === "it" ? "Nome" : "Name (English)"}
          value={draft.name[lang]}
          maxLength={300}
          onChange={(e) => set({ name: { ...draft.name, [lang]: e.target.value } })}
          hint={lang === "en" ? "Se lo lasci vuoto la pagina mostra l’italiano." : undefined}
        />
        <TextArea
          label={lang === "it" ? "Descrizione" : "Description (English)"}
          value={draft.description[lang]}
          max={300}
          onChange={(e) => set({ description: { ...draft.description, [lang]: e.target.value } })}
        />
        {!isWine && (
          <Input
            label="Prezzo"
            inputMode="decimal"
            value={draft.price ?? ""}
            placeholder="12,50"
            onChange={(e) => set({ price: e.target.value || null })}
          />
        )}
        {isWine && (
          <fieldset className={styles.fieldset}>
            <legend>Vino</legend>
            <div className={styles.grid}>
              <Input
                label="Produttore"
                value={wine.producer}
                onChange={(e) => setWine({ producer: e.target.value })}
              />
              <Input
                label="Denominazione"
                value={wine.denomination}
                onChange={(e) => setWine({ denomination: e.target.value })}
                placeholder="Barolo"
              />
              <Select
                label="Tipo"
                value={wine.appellation}
                onChange={(e) =>
                  setWine({ appellation: e.target.value as WineInfo["appellation"] })
                }
              >
                {["", "DOC", "DOCG", "IGT", "IGP", "DOP", "Vino da tavola", "Altro"].map((a) => (
                  <option key={a} value={a}>
                    {a || "—"}
                  </option>
                ))}
              </Select>
              <Input
                label="Annata"
                type="number"
                inputMode="numeric"
                value={wine.vintage ?? ""}
                min={1800}
                max={2100}
                onChange={(e) =>
                  setWine({ vintage: e.target.value ? Number(e.target.value) : null })
                }
              />
              <Input
                label="Vitigno/i"
                value={wine.grapes.join(", ")}
                hint="Separati da virgola"
                onChange={(e) =>
                  setWine({
                    grapes: e.target.value
                      .split(",")
                      .map((g) => g.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Input
                label="Zona"
                value={wine.area}
                onChange={(e) => setWine({ area: e.target.value })}
              />
              <Input
                label="Prezzo al calice"
                inputMode="decimal"
                value={wine.price_glass ?? ""}
                onChange={(e) => setWine({ price_glass: e.target.value || null })}
              />
              <Input
                label="Prezzo alla bottiglia"
                inputMode="decimal"
                value={wine.price_bottle ?? ""}
                onChange={(e) => setWine({ price_bottle: e.target.value || null })}
              />
            </div>
          </fieldset>
        )}
        <ImageField
          label="Foto (facoltativa)"
          purpose="image"
          fileId={draft.photo_file_id}
          files={files}
          onPick={(id) => set({ photo_file_id: id })}
          addFile={addFile}
        />
        <fieldset className={styles.fieldset}>
          <legend>Allergeni (Reg. UE 1169/2011)</legend>
          <div className={styles.checks}>
            {ALLERGENS.map((a) => {
              const Icon = ALLERGEN_META[a].icon;
              return (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={draft.allergens.includes(a)}
                    onChange={() => set({ allergens: toggle(draft.allergens, a) })}
                  />
                  <Icon size={14} aria-hidden="true" /> {ALLERGEN_META[a].it}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>Etichette</legend>
          <div className={styles.checks}>
            {BADGES.map((b) => (
              <label key={b}>
                <input
                  type="checkbox"
                  checked={draft.badges.includes(b)}
                  onChange={() => set({ badges: toggle(draft.badges, b) })}
                />{" "}
                {BADGE_META[b].it}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
