import {
  Clock,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  UserPlus,
} from "lucide-react";
import { Markdown } from "@/lib/markdown";
import {
  DAY_LABEL, MUSIC_LABEL, SOCIAL_LABEL,
  type AddressBlock, type ButtonBlock, type ContactBlock, type FileBlock, type GalleryBlock,
  type HeaderBlock, type LinkListBlock, type MusicLinksBlock, type OpeningHoursBlock, type PageFiles,
  type SocialIconsBlock, type TextBlock,
} from "@/lib/page-types"; // prettier-ignore
import { MusicIcon, SOCIAL_ICON } from "./icons";
import styles from "./page.module.css";

export type Ctx = { files: PageFiles; slug: string | null; preview: boolean };
const img = (ctx: Ctx, id: string | null | undefined, variant = "large") =>
  id ? ctx.files[id]?.urls[variant] : undefined;

export function Header({ block, ctx }: { block: HeaderBlock; ctx: Ctx }) {
  const cover = img(ctx, block.cover_file_id);
  const avatar = img(ctx, block.avatar_file_id);
  return (
    <header className={styles.header} data-cover={cover ? "" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {cover && <img className={styles.cover} src={cover} alt="" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {avatar && <img className={styles.avatar} src={avatar} alt="" width={96} height={96} />}
      {block.title && <h1>{block.title}</h1>}
      {block.subtitle && <p>{block.subtitle}</p>}
    </header>
  );
}

export const Text = ({ block }: { block: TextBlock }) => (
  <div className={styles.text}>
    <Markdown source={block.markdown} />
  </div>
);

const ext = { target: "_blank", rel: "noopener noreferrer" };

export function ButtonView({ block }: { block: ButtonBlock }) {
  return (
    <a className={styles.button} href={block.url} data-track={block.id} {...ext}>
      {block.label}
    </a>
  );
}

export function LinkList({ block }: { block: LinkListBlock }) {
  return (
    <ul className={styles.links}>
      {block.items.map((item, index) => (
        <li key={index}>
          <a
            className={styles.button}
            href={item.url}
            data-track={block.id}
            data-item={index}
            {...ext}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Contact({ block, ctx }: { block: ContactBlock; ctx: Ctx }) {
  const name = [block.first_name, block.last_name].filter(Boolean).join(" ");
  const vcf = ctx.slug ? `/api/public/pages/${ctx.slug}/vcard/${block.id}.vcf` : undefined;
  return (
    <section className={styles.card}>
      {name && <h2>{name}</h2>}
      {(block.job_title || block.organization) && (
        <p className={styles.muted}>
          {[block.job_title, block.organization].filter(Boolean).join(" · ")}
        </p>
      )}
      <ul className={styles.contactList}>
        {block.phones.map((p, i) => (
          <li key={`p${i}`}>
            <a
              href={`tel:${p.number.replace(/[^+\d]/g, "")}`}
              data-track={block.id}
              data-item={`tel${i}`}
            >
              <Phone size={18} aria-hidden="true" /> {p.number}
            </a>
          </li>
        ))}
        {block.emails.map((e, i) => (
          <li key={`e${i}`}>
            <a href={`mailto:${e.address}`} data-track={block.id} data-item={`mail${i}`}>
              <Mail size={18} aria-hidden="true" /> {e.address}
            </a>
          </li>
        ))}
        {block.website && (
          <li>
            <a href={block.website} data-track={block.id} data-item="web" {...ext}>
              <ExternalLink size={18} aria-hidden="true" />{" "}
              {block.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
      {block.note && <p className={styles.muted}>{block.note}</p>}
      <a
        className={styles.button}
        href={vcf}
        aria-disabled={!vcf || undefined}
        data-track={block.id}
        data-item="vcf"
      >
        <UserPlus size={18} aria-hidden="true" /> {block.save_button_label || "Salva contatto"}
      </a>
    </section>
  );
}

export function FileView({ block, ctx }: { block: FileBlock; ctx: Ctx }) {
  const file = ctx.files[block.file_id];
  if (!file) return null;
  const previews = Object.keys(file.urls)
    .filter((k) => k.startsWith("page_"))
    .sort();
  return (
    <section className={styles.card}>
      <h2>
        <FileText size={20} aria-hidden="true" /> {block.label || file.name}
      </h2>
      <div className={styles.pdfPages}>
        {previews.map((key, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            src={file.urls[key]}
            alt={`Pagina ${i + 1}`}
            loading={i ? "lazy" : "eager"}
          />
        ))}
      </div>
      {file.pages && file.pages > previews.length && (
        <p className={styles.muted}>
          Anteprima delle prime {previews.length} pagine su {file.pages}.
        </p>
      )}
      <div className={styles.row}>
        <a
          className={styles.button}
          href={file.urls.original}
          data-track={block.id}
          data-item="open"
          {...ext}
        >
          Apri il PDF
        </a>
        {block.allow_download && (
          <a
            className={styles.buttonGhost}
            href={`${file.urls.original}?download=1`}
            data-track={block.id}
            data-item="download"
          >
            <Download size={18} aria-hidden="true" /> Scarica
          </a>
        )}
      </div>
    </section>
  );
}

export function MusicLinks({ block }: { block: MusicLinksBlock }) {
  return (
    <ul className={styles.links}>
      {block.links.map((link, index) => (
        <li key={index}>
          <a
            className={styles.button}
            href={link.url}
            data-track={block.id}
            data-item={link.platform}
            {...ext}
          >
            <MusicIcon size={18} aria-hidden="true" /> Ascolta su {MUSIC_LABEL[link.platform]}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Gallery({ block, ctx }: { block: GalleryBlock; ctx: Ctx }) {
  return (
    <div className={styles.gallery} data-layout={block.layout}>
      {block.file_ids.map((id, i) =>
        ctx.files[id] ? (
          <a key={id} href={ctx.files[id].urls.large} {...ext} data-track={block.id} data-item={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.layout === "grid" ? ctx.files[id].urls.thumb : ctx.files[id].urls.large}
              alt={`Immagine ${i + 1}`}
              loading={i > 3 ? "lazy" : "eager"}
            />
          </a>
        ) : null,
      )}
    </div>
  );
}

export function SocialIcons({ block }: { block: SocialIconsBlock }) {
  return (
    <ul className={styles.social}>
      {block.items.map((item, index) => {
        const Icon = SOCIAL_ICON[item.network];
        return (
          <li key={index}>
            <a
              href={item.url}
              aria-label={SOCIAL_LABEL[item.network]}
              title={SOCIAL_LABEL[item.network]}
              data-track={block.id}
              data-item={item.network}
              {...ext}
            >
              <Icon size={22} aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function OpeningHours({ block }: { block: OpeningHoursBlock }) {
  return (
    <section className={styles.card}>
      <h2>
        <Clock size={20} aria-hidden="true" /> Orari
      </h2>
      <dl className={styles.hours}>
        {block.days.map((d) => (
          <div key={d.day}>
            <dt>{DAY_LABEL[d.day]}</dt>
            <dd>
              {d.closed || !d.ranges.length
                ? "Chiuso"
                : d.ranges.map((r) => `${r.opens}–${r.closes}`).join(", ")}
            </dd>
          </div>
        ))}
      </dl>
      {block.note && <p className={styles.muted}>{block.note}</p>}
    </section>
  );
}

export function Address({ block }: { block: AddressBlock }) {
  const q = encodeURIComponent(block.query);
  return (
    <section className={styles.card}>
      <h2>
        <MapPin size={20} aria-hidden="true" /> {block.label || "Dove siamo"}
      </h2>
      <p>{block.query}</p>
      <div className={styles.row}>
        {block.providers.includes("google") && (
          <a
            className={styles.buttonGhost}
            href={`https://www.google.com/maps/search/?api=1&query=${q}`}
            data-track={block.id}
            data-item="google"
            {...ext}
          >
            Google Maps
          </a>
        )}
        {block.providers.includes("apple") && (
          <a
            className={styles.buttonGhost}
            href={`https://maps.apple.com/?q=${q}`}
            data-track={block.id}
            data-item="apple"
            {...ext}
          >
            Apple Mappe
          </a>
        )}
      </div>
    </section>
  );
}
