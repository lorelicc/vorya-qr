import { SiteArt } from "./art/SiteArt";
import styles from "./pricing.module.css";

/** The promise of the product, shown prominently on the home and on the pricing page. */
export function Guarantee() {
  return (
    <section className={styles.guarantee} aria-labelledby="guarantee-title">
      <SiteArt name="guarantee" size={180} />
      <div>
        <h2 id="guarantee-title">Garanzia «QR sempre attivi»</h2>
        <p>
          Nessun QR viene mai disattivato perché la prova è finita o l’abbonamento è scaduto. Se
          smetti di pagare passi al piano Free: i tuoi QR e link continuano a funzionare. Oltre i
          limiti del Free i codici diventano in sola lettura (non si possono modificare) finché non
          scegli un piano, e si sbloccano subito.
        </p>
      </div>
    </section>
  );
}
