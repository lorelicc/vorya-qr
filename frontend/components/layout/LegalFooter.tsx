import Link from "next/link";
import styles from "./LegalFooter.module.css";

export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} Vorya Apps · Vorya QR 0.1</span>
      <nav aria-label="Documenti legali">
        <Link href="/legal/termini">Termini</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/cookie">Cookie</Link>
      </nav>
    </footer>
  );
}
