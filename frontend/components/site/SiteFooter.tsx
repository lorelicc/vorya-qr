import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { SITE } from "@/lib/site/config";
import { navGroups } from "./nav";
import styles from "./site.module.css";

/** Full footer: every landing page is linked from here (useful to people and to search engines). */
export function SiteFooter() {
  const groups = navGroups();
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <Brand href="/" tone="light" />
          <p>
            Link brevi e codici QR dinamici in italiano, senza pubblicità. Stampi una volta, cambi
            la destinazione quando vuoi.
          </p>
          <p className={styles.parent}>
            a <a href={SITE.parent.url}>Vorya</a> product
          </p>
        </div>
        {groups.map((group) => (
          <nav
            key={group.key}
            aria-label={group.label}
            className={group.wide ? styles.footerWide : ""}
          >
            <h2>{group.label}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Account e informazioni legali">
          <h2>Vorya QR</h2>
          <ul>
            <li>
              <Link href="/prezzi">Prezzi</Link>
            </li>
            <li>
              <Link href="/register">Prova gratis</Link>
            </li>
            <li>
              <Link href="/login">Accedi</Link>
            </li>
            <li>
              <Link href="/legal/termini">Termini</Link>
            </li>
            <li>
              <Link href="/legal/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/legal/cookie">Cookie</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={`${styles.container} ${styles.copyright}`}>
        © {new Date().getFullYear()} Vorya Apps · Vorya QR
      </div>
    </footer>
  );
}
