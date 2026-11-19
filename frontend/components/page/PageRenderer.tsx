import type { CSSProperties } from "react";
import type { PageBlock, PageDoc, PageFiles } from "@/lib/page-types";
import { AudioPlayer } from "./AudioPlayer";
import {
  Address, ButtonView, Contact, FileView, Gallery, Header, LinkList, MusicLinks, OpeningHours,
  SocialIcons, Text, type Ctx,
} from "./blocks"; // prettier-ignore
import { ClickTracker } from "./ClickTracker";
import styles from "./page.module.css";

const FONT: Record<PageDoc["theme"]["font"], string> = {
  inter: "'Inter', Arial, sans-serif",
  montserrat: "'Montserrat', Arial, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  "space-grotesk": "'Space Grotesk', Arial, sans-serif",
};

function background(page: PageDoc, files: PageFiles): string {
  const bg = page.theme.background;
  if (bg.type === "gradient") return `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.to})`;
  const image = bg.type === "image" && bg.file_id ? files[bg.file_id]?.urls.large : undefined;
  if (image)
    return `linear-gradient(rgba(9,20,17,${bg.overlay}), rgba(9,20,17,${bg.overlay})), url("${image}") center / cover`;
  return bg.color;
}

function render(block: PageBlock, ctx: Ctx) {
  switch (block.type) {
    case "header": return <Header block={block} ctx={ctx} />;
    case "text": return <Text block={block} />;
    case "button": return <ButtonView block={block} />;
    case "link_list": return <LinkList block={block} />;
    case "contact": return <Contact block={block} ctx={ctx} />;
    case "file": return <FileView block={block} ctx={ctx} />;
    case "audio_player": return <AudioPlayer block={block} files={ctx.files} />;
    case "music_links": return <MusicLinks block={block} />;
    case "gallery": return <Gallery block={block} ctx={ctx} />;
    case "social_icons": return <SocialIcons block={block} />;
    case "opening_hours": return <OpeningHours block={block} />;
    case "address": return <Address block={block} />;
    case "divider": return <hr className={styles.divider} data-style={block.style} />;
  }
} // prettier-ignore

type Props = { page: PageDoc; files: PageFiles; slug: string | null; preview?: boolean };

/** Mobile-first hosted page. Same component for the public page and the editor preview. */
export function PageRenderer({ page, files, slug, preview = false }: Props) {
  const dark = page.theme.background.type === "image";
  const style = {
    "--p-primary": page.theme.primary,
    "--p-secondary": page.theme.secondary,
    "--p-font": FONT[page.theme.font],
    background: background(page, files),
  } as CSSProperties;
  return (
    <div
      className={styles.page}
      style={style}
      data-dark={dark || undefined}
      data-buttons={page.theme.button_style}
      data-preview={preview || undefined}
    >
      <main className={styles.content}>
        {page.blocks.map((block, index) => (
          <div
            key={block.id}
            className={styles.block}
            style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
          >
            {render(block, { files, slug, preview })}
          </div>
        ))}
      </main>
      <footer className={styles.footer}>
        {page.settings.show_branding && (
          <a href="https://qr.vorya.it" target="_blank" rel="noopener">
            Creato con Vorya QR
          </a>
        )}
        {slug && <a href={`/report?slug=${slug}`}>Segnala abuso</a>}
      </footer>
      {slug && !preview && <ClickTracker slug={slug} />}
    </div>
  );
}
