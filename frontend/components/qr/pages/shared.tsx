"use client";
import { Lock, X } from "lucide-react";
import { Dropzone } from "@/components/files/Dropzone";
import { Input, Select } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import {
  SOCIAL_LABEL,
  type HeaderBlock,
  type PageDoc,
  type PageFile,
  type PageFiles,
  type SocialIconsBlock,
  type SocialNetwork,
} from "@/lib/page-types";
import type { UploadedFile, UploadPurpose } from "@/lib/upload";
import { ColorField } from "../ColorField";
import { blockId, findBlock, upsertBlock } from "./defaults";
import { ListEditor } from "./ListEditor";
import styles from "./pages.module.css";

export type FormProps = {
  page: PageDoc;
  onChange: (page: PageDoc) => void;
  files: PageFiles;
  addFile: (file: UploadedFile) => void;
  qrId?: number; // set when editing a saved QR (menu quick edits persist immediately)
};

export function toPageFile(file: UploadedFile): PageFile {
  return { kind: file.kind, urls: file.urls, name: file.original_name, pages: file.page_count };
}

/** One image slot: preview + replace/remove, uploading through the company file API. */
export function ImageField({
  label,
  purpose,
  fileId,
  files,
  onPick,
  addFile,
}: {
  label: string;
  purpose: UploadPurpose;
  fileId: string | null | undefined;
  files: PageFiles;
  onPick: (id: string | null) => void;
  addFile: (file: UploadedFile) => void;
}) {
  const { api } = useCompany();
  const url = fileId ? (files[fileId]?.urls.thumb ?? files[fileId]?.urls.large) : undefined;
  return (
    <div className={styles.section}>
      <span>{label}</span>
      {url && (
        <div className={styles.thumb} style={{ maxWidth: 120 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" />
          <button type="button" aria-label={`Rimuovi ${label}`} onClick={() => onPick(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      <Dropzone<UploadedFile>
        compact
        path={`${api}/files`}
        purpose={purpose}
        label={url ? "Sostituisci" : "Carica un’immagine"}
        hint="JPG, PNG o WebP"
        onUploaded={(file) => {
          addFile(file);
          onPick(file.id);
        }}
      />
    </div>
  );
}

export function HeaderFields({
  page,
  onChange,
  files,
  addFile,
  titleLabel = "Titolo",
}: FormProps & { titleLabel?: string }) {
  const header = findBlock(page, "header");
  const set = (patch: Partial<HeaderBlock>) =>
    onChange(
      upsertBlock(page, "header", patch, () => ({
        id: blockId("h"),
        type: "header",
        title: "",
        subtitle: "",
      })),
    );
  return (
    <div className={styles.section}>
      <h3>Intestazione</h3>
      <div className={styles.inline}>
        <Input
          label={titleLabel}
          value={header?.title ?? ""}
          maxLength={120}
          onChange={(e) => set({ title: e.target.value })}
        />
        <Input
          label="Sottotitolo"
          value={header?.subtitle ?? ""}
          maxLength={300}
          onChange={(e) => set({ subtitle: e.target.value })}
        />
      </div>
      <div className={styles.inline}>
        <ImageField
          label="Immagine di copertina"
          purpose="cover"
          fileId={header?.cover_file_id}
          files={files}
          addFile={addFile}
          onPick={(id) => set({ cover_file_id: id })}
        />
        <ImageField
          label="Foto o logo"
          purpose="avatar"
          fileId={header?.avatar_file_id}
          files={files}
          addFile={addFile}
          onPick={(id) => set({ avatar_file_id: id })}
        />
      </div>
    </div>
  );
}

const NETWORKS = Object.keys(SOCIAL_LABEL) as SocialNetwork[];

export function SocialFields({ page, onChange }: Pick<FormProps, "page" | "onChange">) {
  const block = findBlock(page, "social_icons");
  const items = block?.items ?? [];
  const set = (next: SocialIconsBlock["items"]) =>
    onChange(
      upsertBlock(page, "social_icons", { items: next }, () => ({
        id: blockId("s"),
        type: "social_icons",
        items: [],
      })),
    );
  return (
    <div className={styles.section}>
      <h3>Social</h3>
      <ListEditor
        items={items}
        onChange={set}
        max={12}
        addLabel="Aggiungi un social"
        itemLabel={(i) => `social ${i + 1}`}
        create={() => ({ network: "instagram" as SocialNetwork, url: "https://" })}
        render={(item, update) => (
          <>
            <Select
              label="Rete"
              value={item.network}
              onChange={(e) => update({ network: e.target.value as SocialNetwork })}
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {SOCIAL_LABEL[n]}
                </option>
              ))}
            </Select>
            <Input
              label="Link"
              type="url"
              value={item.url}
              onChange={(e) => update({ url: e.target.value })}
            />
          </>
        )}
      />
    </div>
  );
}

export function ThemeFields({
  page,
  onChange,
  files,
  addFile,
  canRemoveBranding,
}: FormProps & { canRemoveBranding: boolean }) {
  const t = page.theme;
  const setTheme = (patch: Partial<PageDoc["theme"]>) =>
    onChange({ ...page, theme: { ...t, ...patch } });
  const setBg = (patch: Partial<PageDoc["theme"]["background"]>) =>
    setTheme({ background: { ...t.background, ...patch } });
  const setSettings = (patch: Partial<PageDoc["settings"]>) =>
    onChange({ ...page, settings: { ...page.settings, ...patch } });
  return (
    <div className={styles.section}>
      <h3>Aspetto della pagina</h3>
      <div className={styles.inline}>
        <ColorField
          label="Colore principale"
          value={t.primary}
          onChange={(primary) => setTheme({ primary })}
        />
        <ColorField
          label="Colore secondario"
          value={t.secondary}
          onChange={(secondary) => setTheme({ secondary })}
        />
      </div>
      <div className={styles.inline}>
        <Select
          label="Sfondo"
          value={t.background.type}
          onChange={(e) => setBg({ type: e.target.value as "solid" })}
        >
          <option value="solid">Tinta unita</option>
          <option value="gradient">Gradiente</option>
          <option value="image">Immagine</option>
        </Select>
        <Select
          label="Carattere"
          value={t.font}
          onChange={(e) => setTheme({ font: e.target.value as PageDoc["theme"]["font"] })}
        >
          <option value="inter">Inter</option>
          <option value="montserrat">Montserrat</option>
          <option value="playfair">Playfair Display</option>
          <option value="space-grotesk">Space Grotesk</option>
        </Select>
      </div>
      {t.background.type !== "image" ? (
        <div className={styles.inline}>
          <ColorField
            label="Colore sfondo"
            value={t.background.color}
            onChange={(color) => setBg({ color })}
          />
          {t.background.type === "gradient" && (
            <ColorField
              label="Secondo colore"
              value={t.background.to}
              onChange={(to) => setBg({ to })}
            />
          )}
        </div>
      ) : (
        <ImageField
          label="Immagine di sfondo"
          purpose="cover"
          fileId={t.background.file_id}
          files={files}
          addFile={addFile}
          onPick={(id) => setBg({ file_id: id })}
        />
      )}
      <Select
        label="Stile dei bottoni"
        value={t.button_style}
        onChange={(e) =>
          setTheme({ button_style: e.target.value as PageDoc["theme"]["button_style"] })
        }
      >
        <option value="rounded">Arrotondati</option>
        <option value="pill">Pillola</option>
        <option value="square">Squadrati</option>
        <option value="outline">Solo bordo</option>
      </Select>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={page.settings.indexable}
          onChange={(e) => setSettings({ indexable: e.target.checked })}
        />{" "}
        Consenti l’indicizzazione sui motori di ricerca
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          disabled={!canRemoveBranding}
          checked={!page.settings.show_branding}
          onChange={(e) => setSettings({ show_branding: !e.target.checked })}
        />
        Nascondi “Creato con Vorya QR”{" "}
        {!canRemoveBranding && (
          <>
            <Lock size={14} aria-hidden="true" /> disponibile nel piano Pro
          </>
        )}
      </label>
      <Input
        label="Titolo per la condivisione (Open Graph)"
        value={page.settings.og.title}
        maxLength={120}
        onChange={(e) => setSettings({ og: { ...page.settings.og, title: e.target.value } })}
      />
    </div>
  );
}
