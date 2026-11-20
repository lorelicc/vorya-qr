import styles from "./mockups.module.css";

/**
 * Light app mockups in plain HTML/CSS (no video, no images): the shapes animate with CSS only
 * when they enter the page, and stop with "reduce motion".
 */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className={styles.frame} aria-label={`Anteprima dell'app: ${title}`}>
      <div className={styles.bar}>
        <i /> <i /> <i /> <span>{title}</span>
      </div>
      <div className={styles.body} aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

export function MockDashboard() {
  return (
    <Frame title="Link e QR">
      <div className={styles.quick}>
        <span className={styles.input}>Incolla un link da accorciare</span>
        <span className={styles.button}>Crea link</span>
      </div>
      {[
        ["Menu estate", "qr.vorya.it/Ab3dEf7", 72],
        ["Biglietto Giulia", "qr.vorya.it/Pg4hJk8", 40],
        ["Promo vetrina", "qr.vorya.it/promo", 58],
      ].map(([name, link, w], i) => (
        <div key={name as string} className={styles.row} style={{ animationDelay: `${i * 120}ms` }}>
          <div className={styles.qr} />
          <div className={styles.meta}>
            <b>{name}</b>
            <small>{link}</small>
          </div>
          <div className={styles.spark}>
            <span style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </Frame>
  );
}

export function MockEditor() {
  return (
    <Frame title="Editor del QR">
      <div className={styles.split}>
        <div className={styles.form}>
          {[80, 60, 90, 50].map((w, i) => (
            <span
              key={i}
              className={styles.line}
              style={{ width: `${w}%`, animationDelay: `${i * 140}ms` }}
            />
          ))}
          <span className={styles.button}>Salva</span>
        </div>
        <div className={styles.phone}>
          <span className={styles.notch} />
          <span className={styles.pill} style={{ width: "60%" }} />
          <span className={styles.pill} style={{ width: "80%", animationDelay: "160ms" }} />
          <span className={styles.cta} />
        </div>
      </div>
    </Frame>
  );
}

export function MockStats() {
  return (
    <Frame title="Statistiche">
      <div className={styles.bars}>
        {[34, 52, 40, 70, 58, 88, 64].map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div className={styles.kpis}>
        <span>Scansioni</span>
        <span>Dispositivi</span>
        <span>Paesi</span>
      </div>
    </Frame>
  );
}
