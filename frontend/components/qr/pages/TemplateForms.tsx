"use client";
import { Dropzone } from "@/components/files/Dropzone";
import { Input, Select } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { MUSIC_LABEL, type ContactBlock, type MusicPlatform } from "@/lib/page-types";
import type { UploadedFile } from "@/lib/upload";
import { MenuEditor } from "@/components/menu/MenuEditor";
import { TextArea } from "../types/StaticForm";
import { BusinessFields } from "./BusinessFields";
import { blockId, findBlock, upsertBlock } from "./defaults";
import { ListEditor } from "./ListEditor";
import { HeaderFields, SocialFields, type FormProps } from "./shared";
import styles from "./pages.module.css";

const newContact = (): ContactBlock => ({
  id: blockId("c"), type: "contact", first_name: "", last_name: "", organization: "", job_title: "", phones: [], emails: [],
  website: "", address: { street: "", city: "", postal_code: "", region: "", country: "" }, note: "", save_button_label: "Salva contatto",
}); // prettier-ignore

export function ContactFields({ page, onChange }: Pick<FormProps, "page" | "onChange">) {
  const c = findBlock(page, "contact") ?? newContact();
  const set = (patch: Partial<ContactBlock>) => onChange(upsertBlock(page, "contact", patch, newContact));
  return (
    <div className={styles.section}>
      <h3>Contatto</h3>
      <div className={styles.inline}>
        <Input label="Nome" value={c.first_name} onChange={(e) => set({ first_name: e.target.value })} autoComplete="off" />
        <Input label="Cognome" value={c.last_name} onChange={(e) => set({ last_name: e.target.value })} autoComplete="off" />
        <Input label="Azienda" value={c.organization} onChange={(e) => set({ organization: e.target.value })} />
        <Input label="Ruolo" value={c.job_title} onChange={(e) => set({ job_title: e.target.value })} />
      </div>
      <ListEditor items={c.phones} onChange={(phones) => set({ phones })} max={6} addLabel="Aggiungi un telefono" itemLabel={(i) => `telefono ${i + 1}`}
        create={() => ({ label: "cell" as const, number: "" })}
        render={(p, update) => (
          <>
            <Select label="Tipo" value={p.label} onChange={(e) => update({ label: e.target.value as "cell" })}>
              <option value="cell">Cellulare</option><option value="work">Lavoro</option><option value="home">Casa</option><option value="other">Altro</option>
            </Select>
            <Input label="Numero" type="tel" value={p.number} onChange={(e) => update({ number: e.target.value })} />
          </>
        )} />
      <ListEditor items={c.emails} onChange={(emails) => set({ emails })} max={6} addLabel="Aggiungi un’email" itemLabel={(i) => `email ${i + 1}`}
        create={() => ({ label: "work" as const, address: "" })}
        render={(e, update) => <Input label="Email" type="email" value={e.address} onChange={(ev) => update({ address: ev.target.value })} />} />
      <Input label="Sito web" type="url" value={c.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
      <div className={styles.inline}>
        <Input label="Indirizzo" value={c.address.street} onChange={(e) => set({ address: { ...c.address, street: e.target.value } })} />
        <Input label="Città" value={c.address.city} onChange={(e) => set({ address: { ...c.address, city: e.target.value } })} />
        <Input label="CAP" value={c.address.postal_code} onChange={(e) => set({ address: { ...c.address, postal_code: e.target.value } })} />
        <Input label="Paese" value={c.address.country} onChange={(e) => set({ address: { ...c.address, country: e.target.value } })} />
      </div>
      <TextArea label="Note" value={c.note} max={500} onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
} // prettier-ignore

export function LinkFields({ page, onChange }: Pick<FormProps, "page" | "onChange">) {
  const block = findBlock(page, "link_list");
  return (
    <div className={styles.section}>
      <h3>Link</h3>
      <ListEditor items={block?.items ?? []} max={30} addLabel="Aggiungi un link" itemLabel={(i) => `link ${i + 1}`}
        onChange={(items) => onChange(upsertBlock(page, "link_list", { items }, () => ({ id: blockId("l"), type: "link_list", items: [] })))}
        create={() => ({ label: "", url: "https://" })}
        render={(item, update) => (
          <>
            <Input label="Testo del bottone" value={item.label} maxLength={120} onChange={(e) => update({ label: e.target.value })} />
            <Input label="URL" type="url" value={item.url} onChange={(e) => update({ url: e.target.value })} />
          </>
        )} />
    </div>
  );
} // prettier-ignore

export function PdfFields({ page, onChange, files, addFile }: FormProps) {
  const { api } = useCompany();
  const block = findBlock(page, "file");
  const file = block ? files[block.file_id] : undefined;
  const pick = (f: UploadedFile) => {
    addFile(f);
    onChange(upsertBlock(page, "file", { file_id: f.id }, () => ({ id: blockId("f"), type: "file", file_id: f.id, label: "", allow_download: true })));
  };
  return (
    <div className={styles.section}>
      <h3>Documento PDF</h3>
      {file && <p className="muted">{file.name} · {file.pages} pagine</p>}
      <Dropzone<UploadedFile> path={`${api}/files`} purpose="pdf" label={file ? "Sostituisci il PDF" : "Trascina qui il PDF o tocca per sceglierlo"} hint="Le prime pagine diventano un’anteprima leggera anche su iPhone." onUploaded={pick} />
      {block && (
        <>
          <Input label="Titolo del documento" value={block.label} maxLength={120} onChange={(e) => onChange(upsertBlock(page, "file", { label: e.target.value }, () => block))} />
          <label className={styles.check}>
            <input type="checkbox" checked={block.allow_download} onChange={(e) => onChange(upsertBlock(page, "file", { allow_download: e.target.checked }, () => block))} /> Mostra il bottone “Scarica”
          </label>
        </>
      )}
    </div>
  );
} // prettier-ignore

const PLATFORMS = Object.keys(MUSIC_LABEL) as MusicPlatform[];

export function MusicFields({ page, onChange, files, addFile }: FormProps) {
  const { api } = useCompany();
  const player = findBlock(page, "audio_player");
  const links = findBlock(page, "music_links");
  const tracks = player?.tracks ?? [];
  const setTracks = (next: typeof tracks) => onChange(upsertBlock(page, "audio_player", { tracks: next }, () => ({ id: blockId("a"), type: "audio_player", tracks: [] })));
  return (
    <div className={styles.section}>
      <h3>Tracce</h3>
      <Dropzone<UploadedFile> multiple path={`${api}/files`} purpose="audio" label="Carica tracce audio" hint="MP3, M4A o WAV" onUploaded={(f) => { addFile(f); setTracks([...((findBlock(page, "audio_player")?.tracks) ?? tracks), { file_id: f.id, title: f.original_name.replace(/\.[^.]+$/, ""), artist: "" }]); }} />
      <ListEditor items={tracks} onChange={setTracks} max={30} addLabel="" itemLabel={(i) => `traccia ${i + 1}`} create={() => tracks[0]}
        render={(t, update) => (
          <>
            <Input label={`Titolo (${files[t.file_id]?.name ?? "file"})`} value={t.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} />
            <Input label="Artista" value={t.artist} maxLength={120} onChange={(e) => update({ artist: e.target.value })} />
          </>
        )} />
      <h3>Piattaforme</h3>
      <ListEditor items={links?.links ?? []} max={5} addLabel="Aggiungi una piattaforma" itemLabel={(i) => `piattaforma ${i + 1}`}
        onChange={(next) => onChange(upsertBlock(page, "music_links", { links: next }, () => ({ id: blockId("m"), type: "music_links", links: [] })))}
        create={() => ({ platform: "spotify" as MusicPlatform, url: "https://" })}
        render={(l, update) => (
          <>
            <Select label="Piattaforma" value={l.platform} onChange={(e) => update({ platform: e.target.value as MusicPlatform })}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{MUSIC_LABEL[p]}</option>)}
            </Select>
            <Input label="Link" type="url" value={l.url} onChange={(e) => update({ url: e.target.value })} />
          </>
        )} />
    </div>
  );
} // prettier-ignore

export function GalleryFields({ page, onChange, files, addFile }: FormProps) {
  const { api } = useCompany();
  const block = findBlock(page, "gallery");
  const ids = block?.file_ids ?? [];
  const set = (file_ids: string[]) => onChange(upsertBlock(page, "gallery", { file_ids }, () => ({ id: blockId("g"), type: "gallery", file_ids: [], layout: "grid" })));
  return (
    <div className={styles.section}>
      <h3>Immagini</h3>
      <Dropzone<UploadedFile> multiple path={`${api}/files`} purpose="gallery" label="Carica immagini" hint="Fino a 40 immagini JPG, PNG o WebP" onUploaded={(f) => { addFile(f); set([...(findBlock(page, "gallery")?.file_ids ?? ids), f.id].slice(0, 40)); }} />
      <div className={styles.images}>
        {ids.map((id) => files[id] && (
          <div key={id} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={files[id].urls.thumb} alt="" />
            <button type="button" aria-label="Rimuovi immagine" onClick={() => set(ids.filter((x) => x !== id))}>×</button>
          </div>
        ))}
      </div>
      {block && (
        <Select label="Disposizione" value={block.layout} onChange={(e) => onChange(upsertBlock(page, "gallery", { layout: e.target.value as "grid" }, () => block))}>
          <option value="grid">Griglia</option>
          <option value="stack">Una sotto l’altra</option>
        </Select>
      )}
    </div>
  );
} // prettier-ignore

export function TemplateForm(props: FormProps) {
  const { page } = props;
  return (
    <div className="stack">
      <HeaderFields
        {...props}
        titleLabel={page.template === "vcard" ? "Nome visualizzato" : "Titolo"}
      />
      {page.template === "vcard" && <ContactFields {...props} />}
      {page.template === "pdf" && <PdfFields {...props} />}
      {page.template === "music" && <MusicFields {...props} />}
      {(page.template === "link_in_bio" || page.template === "vcard") && <LinkFields {...props} />}
      {page.template === "gallery" && <GalleryFields {...props} />}
      {page.template === "business" && <BusinessFields {...props} />}
      {page.template === "menu" && <MenuEditor {...props} qrId={props.qrId} />}
      <SocialFields {...props} />
    </div>
  );
}
