"use client";
import { useEffect, useRef, useState } from "react";
import { DesignScene, LinkScene, StatsScene } from "./scenes";
import styles from "./story.module.css";

const STEPS = [
  {
    key: "link",
    kicker: "1 · Crea",
    title: "Incolla un link, ottieni l’indirizzo breve",
    text: "Un indirizzo lungo diventa qr.vorya.it/estate: lo copi, lo condividi in chat e sui social, e vedi i click salire. Cartelle, tag e ricerca per non perderti.",
  },
  {
    key: "design",
    kicker: "2 · Personalizza",
    title: "Colori, forme e logo. Sempre leggibile.",
    text: "Cambi colori e moduli, aggiungi il tuo logo e il controllo automatico ti avvisa se il codice rischia di non essere letto. Scarichi PNG, SVG o PDF.",
  },
  {
    key: "stats",
    kicker: "3 · Misura",
    title: "Quante scansioni, da dove, con cosa",
    text: "Scansioni per giorno, città e dispositivo. Nessun indirizzo IP viene salvato. E ricevi il report via email, se vuoi.",
  },
] as const;

function SceneFor({ k, active }: { k: (typeof STEPS)[number]["key"]; active: boolean }) {
  if (k === "link") return <LinkScene active={active} />;
  if (k === "design") return <DesignScene active={active} />;
  return <StatsScene active={active} />;
}

/**
 * Scroll story: on desktop the scene stays in place and changes with the step that is in the
 * middle of the screen; on a phone each step carries its own scene right under the text.
 */
export function HowItWorks() {
  const [current, setCurrent] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.story}>
      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li
            key={step.key}
            ref={(node) => {
              refs.current[i] = node;
            }}
            data-i={i}
            data-current={current === i}
            className={styles.step}
          >
            <p className={styles.kicker}>{step.kicker}</p>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <div className={styles.inline}>
              <SceneFor k={step.key} active />
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.sticky} aria-hidden="false">
        {STEPS.map((step, i) => (
          <div key={step.key} className={styles.layer} data-current={current === i}>
            <SceneFor k={step.key} active={current === i} />
          </div>
        ))}
      </div>
    </div>
  );
}
