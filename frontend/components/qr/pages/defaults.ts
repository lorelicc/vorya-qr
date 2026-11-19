import type { Company } from "@/lib/types";
import type { PageBlock, PageDoc, Template } from "@/lib/page-types";

let counter = 0;
export const blockId = (prefix: string) =>
  `${prefix}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}`;

const header = (title: string, subtitle = ""): PageBlock => ({
  id: blockId("h"),
  type: "header",
  title,
  subtitle,
  cover_file_id: null,
  avatar_file_id: null,
});

/** A starting page for each template, themed with the company branding. */
export function defaultPage(
  template: Template,
  company: Pick<Company, "name" | "primary_color" | "secondary_color">,
): PageDoc {
  const blocks: Record<Template, PageBlock[]> = {
    vcard: [
      header("", company.name),
      {
        id: blockId("c"), type: "contact", first_name: "", last_name: "", organization: company.name, job_title: "",
        phones: [{ label: "cell", number: "" }], emails: [{ label: "work", address: "" }], website: "",
        address: { street: "", city: "", postal_code: "", region: "", country: "" }, note: "", save_button_label: "Salva contatto",
      },
      { id: blockId("s"), type: "social_icons", items: [] },
    ],
    pdf: [header(company.name, "")],
    music: [header("", company.name), { id: blockId("m"), type: "music_links", links: [] }],
    link_in_bio: [header(company.name, ""), { id: blockId("l"), type: "link_list", items: [{ label: "", url: "https://" }] }, { id: blockId("s"), type: "social_icons", items: [] }],
    gallery: [header(company.name, "")],
    menu: [
      header(company.name, ""),
      { id: blockId("m"), type: "menu", currency: "EUR", intro: { it: "", en: "" }, sections: [] },
    ],
    business: [
      header(company.name, ""),
      { id: blockId("t"), type: "text", markdown: "" },
      { id: blockId("o"), type: "opening_hours", days: (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => ({ day, closed: day === "sun", ranges: day === "sun" ? [] : [{ opens: "09:00", closes: "18:00" }] })), note: "" },
      { id: blockId("a"), type: "address", label: "", query: "", providers: ["google", "apple"] },
      { id: blockId("s"), type: "social_icons", items: [] },
    ],
  }; // prettier-ignore
  return {
    schema_version: 1,
    template,
    theme: {
      primary: company.primary_color,
      secondary: company.secondary_color,
      background: {
        type: "gradient",
        color: "#f5faf7",
        to: "#d8fae9",
        angle: 160,
        file_id: null,
        overlay: 0.45,
      },
      button_style: "rounded",
      font: "inter",
    },
    settings: {
      languages: ["it"],
      indexable: false,
      show_branding: true,
      og: { title: "", description: "", image_file_id: null },
    },
    blocks: blocks[template],
  };
}

/** "www.sito.it" -> "https://www.sito.it": people rarely type the scheme. Empty stays empty. */
export function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v || v === "https://" || /^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return /^[^\s/]+\.[^\s/]+/.test(v) ? `https://${v.replace(/^\/\//, "")}` : v;
}

/** Removes empty optional blocks/items before saving, so half-filled rows never fail validation. */
export function cleanPage(page: PageDoc): PageDoc {
  const blocks = page.blocks
    .map((b): PageBlock | null => {
      if (b.type === "menu")
        return {
          ...b,
          sections: b.sections
            .filter((sec) => sec.title.it.trim())
            .map((sec) => ({ ...sec, items: sec.items.filter((i) => i.name.it.trim()) })),
        };
      if (b.type === "link_list") return { ...b, items: b.items.filter((i) => i.label.trim() && i.url.trim() && i.url !== "https://").map((i) => ({ ...i, url: normalizeUrl(i.url) })) };
      if (b.type === "social_icons") return b.items.some((i) => i.url.trim()) ? { ...b, items: b.items.filter((i) => i.url.trim()).map((i) => ({ ...i, url: normalizeUrl(i.url) })) } : null;
      if (b.type === "music_links") return b.links.some((l) => l.url.trim()) ? { ...b, links: b.links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: normalizeUrl(l.url) })) } : null;
      if (b.type === "contact") {
        const named = b.first_name.trim() || b.last_name.trim() || b.organization.trim();
        if (!named && page.template !== "vcard") return null;
        return { ...b, website: normalizeUrl(b.website), phones: b.phones.filter((p) => p.number.trim()), emails: b.emails.filter((e) => e.address.trim()) };
      }
      if (b.type === "gallery" && !b.file_ids.length && page.template !== "gallery") return null;
      if (b.type === "text") return b.markdown.trim() ? b : null;
      if (b.type === "address") return b.query.trim() ? b : null;
      return b;
    })
    .filter((b): b is PageBlock => b !== null);
  return { ...page, blocks };
} // prettier-ignore

export function findBlock<T extends PageBlock["type"]>(
  page: PageDoc,
  type: T,
): Extract<PageBlock, { type: T }> | undefined {
  return page.blocks.find((b) => b.type === type) as Extract<PageBlock, { type: T }> | undefined;
}

/** Immutable update of the first block of a type (adds it, before trailing socials, if missing). */
export function upsertBlock<T extends PageBlock["type"]>(page: PageDoc, type: T, patch: Partial<Extract<PageBlock, { type: T }>>, create: () => Extract<PageBlock, { type: T }>): PageDoc {
  const existing = findBlock(page, type);
  if (existing) return { ...page, blocks: page.blocks.map((b) => (b === existing ? ({ ...b, ...patch } as PageBlock) : b)) };
  const block = { ...create(), ...patch } as PageBlock;
  const socialIndex = page.blocks.findIndex((b) => b.type === "social_icons");
  const blocks = [...page.blocks];
  blocks.splice(socialIndex === -1 ? blocks.length : socialIndex, 0, block);
  return { ...page, blocks };
} // prettier-ignore
