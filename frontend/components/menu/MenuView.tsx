"use client";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ALLERGENS, BADGES, localized, type Allergen, type Badge, type Lang, type MenuBlock,
  type MenuItem, type PageFiles,
} from "@/lib/page-types"; // prettier-ignore
import {
  ALLERGEN_META, UI, allergenLabel, badgeLabel, formatPrice,
} from "./allergens"; // prettier-ignore
import styles from "./menu.module.css";

function Allergens({ list, lang }: { list: Allergen[]; lang: Lang }) {
  if (!list.length) return null;
  return (
    <ul className={styles.allergens} aria-label={UI[lang].legend}>
      {list.map((a) => {
        const Icon = ALLERGEN_META[a].icon;
        return (
          <li key={a} title={allergenLabel(a, lang)}>
            <Icon size={14} aria-hidden="true" />
            <span className="visually-hidden">{allergenLabel(a, lang)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Item({
  item,
  block,
  lang,
  files,
}: {
  item: MenuItem;
  block: MenuBlock;
  lang: Lang;
  files: PageFiles;
}) {
  const photo = item.photo_file_id ? files[item.photo_file_id]?.urls.medium : undefined;
  const prices = item.wine
    ? [
        item.wine.price_glass &&
          `${UI[lang].glass} ${formatPrice(item.wine.price_glass, block.currency, lang)}`,
        item.wine.price_bottle &&
          `${UI[lang].bottle} ${formatPrice(item.wine.price_bottle, block.currency, lang)}`,
      ].filter(Boolean)
    : [];
  const wine = item.wine;
  const details = wine
    ? [
        wine.producer,
        [wine.appellation, wine.denomination].filter(Boolean).join(" "),
        wine.area,
        wine.grapes.join(", "),
        wine.vintage ? `${UI[lang].vintage} ${wine.vintage}` : "",
      ].filter(Boolean)
    : [];
  return (
    <li className={styles.item} data-sold-out={item.sold_out || undefined}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- own uploads, already resized
        <img src={photo} alt="" width={72} height={72} loading="lazy" className={styles.photo} />
      )}
      <div className={styles.itemBody}>
        <div className={styles.itemHead}>
          <h4>{localized(item.name, lang)}</h4>
          {item.price && (
            <span className={styles.price}>{formatPrice(item.price, block.currency, lang)}</span>
          )}
        </div>
        {item.sold_out && <span className={styles.soldOut}>{UI[lang].soldOut}</span>}
        {localized(item.description, lang) && <p>{localized(item.description, lang)}</p>}
        {details.length > 0 && <p className={styles.wine}>{details.join(" · ")}</p>}
        {prices.length > 0 && <p className={styles.winePrices}>{prices.join(" · ")}</p>}
        <div className={styles.tags}>
          {item.badges.map((b) => (
            <span key={b} className={styles.badge} data-badge={b}>
              {badgeLabel(b, lang)}
            </span>
          ))}
          <Allergens list={item.allergens} lang={lang} />
        </div>
      </div>
    </li>
  );
}

/**
 * Public menu: sticky section bar, search, badge and allergen filters, IT/EN switch. Plain React
 * state, no libraries: it stays as light as the other hosted pages.
 */
export function MenuView({
  block,
  files,
  languages,
}: {
  block: MenuBlock;
  files: PageFiles;
  languages: Lang[];
}) {
  const [lang, setLang] = useState<Lang>("it");
  const [term, setTerm] = useState("");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [without, setWithout] = useState<Allergen[]>([]);
  const t = UI[lang];
  const needle = term.trim().toLowerCase();

  const sections = useMemo(
    () =>
      block.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (badges.some((b) => !item.badges.includes(b))) return false;
            if (without.some((a) => item.allergens.includes(a))) return false;
            if (!needle) return true;
            const text = [localized(item.name, lang), localized(item.description, lang), item.name.it,
              item.wine?.producer, item.wine?.denomination, item.wine?.grapes.join(" ")]
              .join(" ").toLowerCase(); // prettier-ignore
            return text.includes(needle);
          }),
        }))
        .filter((s) => s.items.length),
    [block.sections, badges, without, needle, lang],
  );
  const usedAllergens = ALLERGENS.filter((a) =>
    block.sections.some((s) => s.items.some((i) => i.allergens.includes(a))),
  );
  const usedBadges = BADGES.filter((b) =>
    block.sections.some((s) => s.items.some((i) => i.badges.includes(b))),
  );
  const filtering = Boolean(needle || badges.length || without.length);
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <section className={styles.menu} lang={lang} aria-label="Menu">
      {languages.length > 1 && (
        <div className={styles.lang} role="radiogroup" aria-label="Lingua / Language">
          {languages.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {localized(block.intro, lang) && (
        <p className={styles.intro}>{localized(block.intro, lang)}</p>
      )}

      <nav className={styles.sectionBar} aria-label={t.sections}>
        {block.sections.map((s) => (
          <a key={s.id} href={`#menu-${s.id}`}>
            {localized(s.title, lang)}
          </a>
        ))}
      </nav>

      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">{t.search}</span>
          <input
            type="search"
            placeholder={t.search}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        {(usedBadges.length > 0 || usedAllergens.length > 0) && (
          <details className={styles.filters}>
            <summary>
              {t.filters}
              {filtering ? " •" : ""}
            </summary>
            {usedBadges.length > 0 && (
              <div role="group" aria-label={t.only}>
                {usedBadges.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={badges.includes(b)}
                    onClick={() => setBadges(toggle(badges, b))}
                  >
                    {badgeLabel(b, lang)}
                  </button>
                ))}
              </div>
            )}
            {usedAllergens.length > 0 && (
              <div role="group" aria-label={t.without}>
                <small>{t.without}</small>
                {usedAllergens.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={without.includes(a)}
                    onClick={() => setWithout(toggle(without, a))}
                  >
                    {allergenLabel(a, lang)}
                  </button>
                ))}
              </div>
            )}
          </details>
        )}
      </div>

      <div aria-live="polite">
        {sections.map((section) => (
          <section key={section.id} id={`menu-${section.id}`} className={styles.section}>
            <h3>{localized(section.title, lang)}</h3>
            <ul>
              {section.items.map((item) => (
                <Item key={item.id} item={item} block={block} lang={lang} files={files} />
              ))}
            </ul>
          </section>
        ))}
        {sections.length === 0 && (
          <p className={styles.empty}>
            {t.none}{" "}
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setBadges([]);
                setWithout([]);
              }}
            >
              {t.reset}
            </button>
          </p>
        )}
      </div>

      {usedAllergens.length > 0 && (
        <aside className={styles.legend} aria-label={t.legend}>
          <h3>{t.legend}</h3>
          <ul>
            {usedAllergens.map((a) => {
              const Icon = ALLERGEN_META[a].icon;
              return (
                <li key={a}>
                  <Icon size={14} aria-hidden="true" /> {allergenLabel(a, lang)}
                </li>
              );
            })}
          </ul>
        </aside>
      )}
    </section>
  );
}
