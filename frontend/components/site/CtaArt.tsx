import { QrGlyph } from "./scenes/Qr";
import styles from "./blocks.module.css";

/** Animated illustration of the closing card: a QR that floats and gets "scanned". */
export function CtaArt() {
  return (
    <div className={styles.ctaArt} aria-hidden="true">
      <span className={`${styles.orb} ${styles.orbA}`} />
      <span className={`${styles.orb} ${styles.orbB}`} />
      <div className={styles.ctaQr}>
        <QrGlyph variant="round" />
        <i />
      </div>
      <span className={styles.ctaChip}>qr.vorya.it/tuo-link</span>
    </div>
  );
}
