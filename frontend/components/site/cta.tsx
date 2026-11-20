import { ButtonLink } from "@/components/ui";
import { CtaArt } from "./CtaArt";
import { Reveal } from "./Reveal";
import styles from "./blocks.module.css";

/** Closing card of every page: rounded, animated, overlapping the footer. */
export function CtaBand({
  title,
  text,
  event = "prova-gratis-cta",
}: {
  title: string;
  text: string;
  event?: string;
}) {
  return (
    <section className={styles.ctaWrap}>
      <div className={styles.container}>
        <Reveal className={styles.ctaCard}>
          <div className={styles.ctaCopy}>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className={styles.actions}>
              <ButtonLink href="/register" data-umami-event={event}>
                Prova gratis
              </ButtonLink>
              <ButtonLink href="/prezzi" variant="secondary" className={styles.ctaSecondary}>
                Vedi i prezzi
              </ButtonLink>
            </div>
          </div>
          <CtaArt />
        </Reveal>
      </div>
    </section>
  );
}
